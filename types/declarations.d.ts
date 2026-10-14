declare module 'react-test-renderer' {
  const content: any;
  export default content;
  export const act: (callback: () => void | Promise<void>) => any;
}

declare module '*.png' {
  const value: any;
  export default value;
}
