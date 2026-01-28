import { execa } from 'execa';

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function exec(command: string): Promise<ExecResult> {
  try {
    const result = await execa(command, {
      shell: true,
      stdio: 'pipe',
    });

    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('failed to execute command');
  }
}
