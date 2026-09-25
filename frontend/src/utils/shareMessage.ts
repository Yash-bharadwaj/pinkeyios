// Builds the WhatsApp/SMS-friendly "here's your access" message an admin
// sends to a magician. `password` is optional: it's only known right when an
// account is created or its password is reset — Firebase never hands back an
// existing password (correct security practice, not a limitation we chose),
// so sharing for an existing account just omits that line.
export function buildAccessMessage({
  name,
  email,
  password,
  licenseKey,
}: {
  name?: string;
  email: string;
  password?: string;
  licenseKey: string;
}): string {
  const greetingName = name?.trim() || "there";
  const lines = [
    `Hey ${greetingName}, your PINKEY access is ready.`,
    ``,
    `Email: ${email}`,
  ];
  if (password) lines.push(`Password: ${password}`);
  lines.push(
    `License Key: ${licenseKey}`,
    ``,
    `How to get started:`,
    `1. Open the PINKEY app and sign in with the email${password ? " & password above" : " and your password"}.`,
    `2. When asked, enter your License Key to activate.`,
    `3. Go to Setup, choose your routine, then tap Start Performance.`,
    ``,
    `Keep this message to yourself — it's your personal access.`,
  );
  return lines.join("\n");
}
