import { generateInvitePassword, hashPassword } from "./password.js";
import { AuthStore, normalizeEmail } from "./store.js";

export async function inviteUser(
  store: AuthStore,
  email: string,
): Promise<{ email: string; password: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@") || normalized.startsWith("@") || normalized.endsWith("@")) {
    throw new Error("invalid email");
  }
  if (store.findUserByEmail(normalized)) {
    throw new Error("user already exists");
  }
  const password = generateInvitePassword();
  const hash = await hashPassword(password);
  store.createUser(normalized, hash);
  return { email: normalized, password };
}

export function writeInviteOnce(created: { email: string; password: string }): void {
  process.stdout.write("email: " + created.email + "\n");
  process.stdout.write("one-time password: " + created.password + "\n");
}

export async function runInviteCli(argv: string[] = process.argv): Promise<void> {
  const { loadLocalEnv } = await import("../load-env.js");
  const { resolveDbPath } = await import("./store.js");
  loadLocalEnv();
  const email = argv[2]?.trim();
  if (!email) {
    process.exitCode = 1;
    console.error("missing email");
    return;
  }
  const store = AuthStore.open(resolveDbPath());
  try {
    writeInviteOnce(await inviteUser(store, email));
  } catch (err) {
    const message = err instanceof Error ? err.message : "invite failed";
    console.error(message);
    process.exitCode = 1;
  } finally {
    store.close();
  }
}
