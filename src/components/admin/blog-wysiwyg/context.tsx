"use client";

import { createContext } from "react";

export interface BlogWysiwygProductOption {
  slug: string;
  title: string;
}

export interface BlogWysiwygContextValue {
  products: BlogWysiwygProductOption[];
  onUploadImage: (file: File) => Promise<string>;
}

export const BlogWysiwygContext = createContext<BlogWysiwygContextValue | null>(
  null,
);
