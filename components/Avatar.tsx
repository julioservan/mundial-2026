import Image from "next/image";

interface Props {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}

// Muestra la foto del usuario, o su inicial sobre fondo de color si no tiene.
export function Avatar({ url, name, size = 40, className = "" }: Props) {
  const dimension = { width: size, height: size };

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        style={dimension}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={dimension}
      className={`rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold uppercase ${className}`}
    >
      {(name || "?").charAt(0)}
    </span>
  );
}
