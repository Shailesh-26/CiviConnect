// localStorage can be blocked (private windows, strict settings); never let that break the app.
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: the setting simply is not remembered.
  }
}
