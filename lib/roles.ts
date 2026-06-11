// El nivel se deriva de is_admin. Dos niveles: Usuario y Admin.
export type Level = "user" | "admin";

export function levelOf(isAdmin: boolean | null | undefined): Level {
  return isAdmin ? "admin" : "user";
}

export function levelLabel(isAdmin: boolean | null | undefined): string {
  return isAdmin ? "Admin" : "Usuario";
}
