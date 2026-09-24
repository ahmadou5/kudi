import { create } from 'zustand';

export interface LoaderOptions {
  message?: string;
  title?: string;
}

export interface LoaderState {
  visible: boolean;
  message?: string;
  title?: string;
  showLoader: (options?: LoaderOptions | string) => void;
  hideLoader: () => void;
}

export const useLoaderStore = create<LoaderState>((set) => ({
  visible: false,
  message: undefined,
  title: undefined,
  showLoader: (options) => {
    if (typeof options === 'string') {
      set({ visible: true, message: options, title: undefined });
    } else {
      set({
        visible: true,
        message: options?.message,
        title: options?.title
      });
    }
  },
  hideLoader: () => {
    set({ visible: false, message: undefined, title: undefined });
  }
}));

export function useLoader() {
  const showLoader = useLoaderStore((s) => s.showLoader);
  const hideLoader = useLoaderStore((s) => s.hideLoader);
  const visible = useLoaderStore((s) => s.visible);
  const message = useLoaderStore((s) => s.message);
  const title = useLoaderStore((s) => s.title);

  return { showLoader, hideLoader, visible, message, title };
}
