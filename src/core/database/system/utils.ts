import { customAlphabet } from "nanoid";

export function autogenerateID(): string {
  // Create the generator function ONCE with your custom alphabet and length
  const generateID = customAlphabet(
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    16
  );

  // Call the generator function to produce the actual ID string
  const genUID = generateID(); // Example output: 'G7K2aZp9'

  return genUID;
}
