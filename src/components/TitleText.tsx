type TitleTextProps = {
  text: string;
  level?: 1 | 2 | 3;
};

export function TitleText({ text, level = 1 }: TitleTextProps) {
  if (level === 2) return <h2 class="title-text">{text}</h2>;
  if (level === 3) return <h3 class="title-text">{text}</h3>;
  return <h1 class="title-text">{text}</h1>;
}
