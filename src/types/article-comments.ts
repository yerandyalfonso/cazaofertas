export type ArticleCommentStatus = "pending" | "approved" | "hidden";

export interface ArticleCommentRow {
  id: string;
  article_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  body: string;
  admin_reply: string | null;
  admin_replied_at: string | null;
  status: ArticleCommentStatus;
  notify_on_reply: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArticleCommentWithArticle extends ArticleCommentRow {
  article?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}
