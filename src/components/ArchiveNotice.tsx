interface Props {
  message: string;
  url: string;
}

export default function ArchiveNotice({ message, url }: Props) {
  const links = [
    { href: url, label: 'Open original' },
    {
      href: `https://web.archive.org/web/*/${url}`,
      label: 'Search archive.org',
    },
    { href: `https://archive.is/${url}`, label: 'Search archive.is' },
  ];

  return (
    <div className="mx-auto max-w-3xl mt-8 flex flex-col gap-3 rounded-lg border border-base-content/20 bg-base-200 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <svg
          aria-hidden="true"
          className="w-5 h-5 text-warning"
          viewBox="0 0 24 24"
        >
          <use href={`#lock`} />
        </svg>
        <span>{message}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info underline underline-offset-2"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
