/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base de l'API (vide = meme origine, cas de l'image Docker). */
  readonly VITE_API_URL?: string;
}
