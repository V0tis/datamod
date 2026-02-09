declare module 'google-translate-api-next' {
  interface TranslateOptions {
    to?: string
    from?: string
    client?: 'gtx' | 't'
  }
  function translate(
    text: string | string[],
    options?: TranslateOptions
  ): Promise<{ text: string } | { text: string }[]>
  export default translate
}
