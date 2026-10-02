import type { Request, Response } from '../types/model';

export async function request<T>(message: Request): Promise<T> {
  const response = await chrome.runtime.sendMessage<Request, Response>(message);
  if (!response?.ok)
    throw new Error(response?.error ?? 'The extension could not complete that request.');
  return response.data as T;
}
