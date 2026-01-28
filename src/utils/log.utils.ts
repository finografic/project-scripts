/* -------------------------------------------------------------------------- */
/* basic logger                                                               */
/* -------------------------------------------------------------------------- */

export const log = {
  header(message: string): void {
    console.log(`\n${message}\n`);
  },

  step(message: string): void {
    console.log(`→ ${message}`);
  },

  info(message: string): void {
    console.log(`ℹ ${message}`);
  },

  success(message: string): void {
    console.log(`✔ ${message}`);
  },

  error(message: string): void {
    console.error(`✖ ${message}`);
  },
};
