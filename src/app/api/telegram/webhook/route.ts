import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import {
  handleCallbackQuery,
  handleNewAlert,
  handleTelegramCommand,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/services/telegram/bot";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

function assertTelegramWebhookSecret(request: NextRequest): void {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    throw new Error("Falta TELEGRAM_WEBHOOK_SECRET.");
  }

  const provided = request.headers.get(SECRET_HEADER);
  if (provided !== expected) {
    throw new Error("No autorizado.");
  }
}

async function upsertTelegramUser(options: {
  telegramId: number;
  username?: string;
}): Promise<void> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await client
    .from("users")
    .select("id")
    .eq("telegram_id", options.telegramId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    const { error } = await client
      .from("users")
      .update({
        telegram_username: options.username ?? null,
        last_active_at: now,
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await client.from("users").insert({
    telegram_id: options.telegramId,
    telegram_username: options.username ?? null,
    last_active_at: now,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function extractCommand(text: string): string | null {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?/);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function POST(request: NextRequest) {
  try {
    assertTelegramWebhookSecret(request);

    const body = (await request.json()) as TelegramUpdate;

    if (body.callback_query) {
      const from = body.callback_query.from;
      try {
        await upsertTelegramUser({
          telegramId: from.id,
          username: from.username,
        });
      } catch (error) {
        console.error(
          "[telegram/webhook] Falló upsertTelegramUser en callback_query (se continúa igual)",
          {
            telegramId: from.id,
            error: error instanceof Error ? error.message : error,
          },
        );
      }

      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message?.text || !message.from) {
      return NextResponse.json({ ok: true });
    }

    await upsertTelegramUser({
      telegramId: message.from.id,
      username: message.from.username,
    });

    const command = extractCommand(message.text);

    if (command) {
      const handled = await handleTelegramCommand(command, {
        chatId: message.chat.id,
        telegramId: message.from.id,
      });
      if (handled) {
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage({
        chatId: message.chat.id,
        text: `El comando /${command} no está disponible. Usa /help.`,
      });
      return NextResponse.json({ ok: true });
    }

    await handleNewAlert(message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en webhook de Telegram";
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
