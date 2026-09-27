/**
 * Usuarios de prueba (`users.is_test`): sus avisos se desvían al chat privado
 * del admin con una etiqueta, en vez de a su telegram_id (que es inventado).
 */
export interface AlertRecipient {
  chatId: number | string;
  /** Prefijo para el mensaje («🧪 Prueba · test_alertas_017»), o null. */
  testLabel: string | null;
}

export function alertRecipient(user: {
  telegram_id: number | null;
  telegram_username?: string | null;
  is_test?: boolean | null;
}): AlertRecipient | null {
  if (user.is_test) {
    const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
    if (!admin) return null;
    return {
      chatId: admin,
      testLabel: `🧪 Prueba · ${user.telegram_username ?? "usuario de test"}`,
    };
  }
  if (user.telegram_id === null) return null;
  return { chatId: user.telegram_id, testLabel: null };
}
