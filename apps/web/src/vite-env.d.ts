/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LCOS_VERSION: string
  readonly VITE_LCOS_BRANCH: string
  readonly VITE_LCOS_COMMIT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
