export type SecretsStoreBinding = { get(): Promise<string> };

export async function storedValue(
	value: string | undefined,
	binding: SecretsStoreBinding | undefined,
): Promise<string | undefined> {
	return value ?? binding?.get();
}
