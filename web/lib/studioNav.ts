export const LAST_STUDIO_KEY = "fs_last_studio_v1";

export type Studio = "l4l" | "role" | "development" | "budget" | "upgrade";

export function getLastStudio(): Studio {
  if (typeof window === "undefined") return "l4l";
  const v = sessionStorage.getItem(LAST_STUDIO_KEY);
  if (v === "budget") return "budget";
  if (v === "upgrade") return "upgrade";
  if (v === "development") return "development";
  if (v === "role") return "role";
  return "l4l";
}

export function setLastStudio(studio: Studio): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAST_STUDIO_KEY, studio);
  } catch {
    // ignore quota/private-mode issues
  }
}

export function studioBackHref(studio: Studio): string {
  if (studio === "role") return "/studio/role";
  if (studio === "development") return "/studio/development";
  if (studio === "budget") return "/studio/budget";
  if (studio === "upgrade") return "/studio/upgrade";
  return "/studio/l4l";
}

export function studioBackLabel(studio: Studio): string {
  if (studio === "role") return "Voltar ao Role";
  if (studio === "development") return "Voltar ao Development";
  if (studio === "budget") return "Voltar ao Budget";
  if (studio === "upgrade") return "Voltar ao Upgrade";
  return "Voltar ao L4L";
}

