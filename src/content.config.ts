import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

const artwork = defineCollection({
  // "glob" tells Astro: every .md file in this folder is one entry in the collection.
  loader: glob({ pattern: '**/*.md', base: './src/content/artwork' }),
  // "schema" is the contract every entry must follow. If a file is missing a
  // required field, or has the wrong type, the build fails loudly instead of
  // shipping a broken page.
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.number(),
      medium: z.string(),
      dimensions: z.string().optional(),
      // image() is a special Astro helper: it validates that the path points
      // to a real image file, and lets Astro optimize it at build time
      // (resize, convert to modern formats, and — importantly for us —
      // know its exact width/height so the browser never has to guess).
      image: image(),
      imageAlt: z.string(),
      description: z.string().optional(),
      featured: z.boolean().default(false),
    }),
});

export const collections = { artwork };
