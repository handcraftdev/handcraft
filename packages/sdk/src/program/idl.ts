export const idl = {
  address: "25WLThAnXWyNZcTLJpXkx6Gh7b7Go9DNNiZrZdWEKabi",
  metadata: {
    name: "content_registry",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Handcraft on-chain content registry",
  },
  instructions: [
    { name: "create_profile", discriminator: [225, 205, 234, 143, 17, 186, 50, 220] },
    { name: "create_content", discriminator: [196, 78, 200, 14, 158, 190, 68, 223] },
    { name: "tip_content", discriminator: [12, 29, 43, 141, 181, 42, 144, 92] },
    { name: "update_content", discriminator: [201, 145, 238, 112, 36, 231, 69, 8] },
  ],
} as const;
