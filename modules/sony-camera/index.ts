// Re-export the native module. On web, it will be resolved to SonyCameraModule.web.ts
// and on native platforms to SonyCameraModule.ts
export { default } from './src/SonyCameraModule';
export { default as SonyCameraView } from './src/SonyCameraView';
export * from './src/SonyCamera.types';
