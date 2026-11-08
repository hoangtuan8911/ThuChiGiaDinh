/// <reference types="vite/client" />

/** ISO timestamp (UTC) ghi lại lúc build, do vite.config.ts bơm vào. */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
