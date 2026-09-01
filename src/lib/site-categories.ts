import { BLOG_CATEGORIES } from "@/lib/category-taxonomy";

export type {
  BlogCategoryDefinition,
  BlogCategorySlug,
  SubcategoryDefinition,
} from "@/lib/category-taxonomy";
export {
  BLOG_CATEGORIES,
  DEFAULT_SUBCATEGORY_BY_PARENT,
  GENERAL_CHILD_SLUG,
  LEGACY_MIRROR_SUBCATEGORY_SLUGS,
  LEGACY_PARENT_SLUG_TO_SUBCATEGORY,
  PRODUCT_SUBCATEGORIES,
  composeSubcategorySlug,
  getBlogCategory,
  getSubcategory,
  getSubcategoryByPath,
  isBlogCategorySlug,
  isGeneralSubcategorySlug,
  normalizeSubcategorySlug,
  parseSubcategorySlug,
  productMatchesSubcategory,
  resolveCategoryDisplayMeta,
  resolveParentSlug,
  resolveSubcategorySlug,
  childSlugFromSubcategory,
  categoryPublicPath,
  resolveSubcategoryFromPath,
  subcategoryLookupKey,
  telegramTopicSlugForCategory,
} from "@/lib/category-taxonomy";

/** Catálogo público del blog (14 categorías padre). */
export const SITE_CATEGORIES = BLOG_CATEGORIES;

export type SiteCategorySlug = (typeof SITE_CATEGORIES)[number]["slug"];

/** Wizard Telegram: categorías padre visibles para el usuario. */
export const WIZARD_CATEGORY_OPTIONS = SITE_CATEGORIES.filter(
  (category) => category.slug !== "otros",
).map((category) => ({
  label: category.telegramLabel,
  slug: category.slug,
}));
