// Next's Link takes `prefetch` and does not pass it to the page; neither does this stand-in.
export default function Link({ prefetch: _prefetch, ...props }: Record<string, unknown>) { return <a {...(props as object)} />; }
