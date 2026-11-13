/** Environment variables, as the matcher reads them to fill in `$NAME` and `%NAME%`. */
export type Env = Readonly<Record<string, string | undefined>>;
