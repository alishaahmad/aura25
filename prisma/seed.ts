import { PrismaClient, TagGroup } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tags: Prisma.TagCreateManyInput[] = [
    // Allergens
    { key: "milk", label: "Milk", group: TagGroup.ALLERGEN },
    { key: "egg", label: "Egg", group: TagGroup.ALLERGEN },
    { key: "peanut", label: "Peanut", group: TagGroup.ALLERGEN },
    { key: "tree_nut", label: "Tree Nut", group: TagGroup.ALLERGEN },
    { key: "soy", label: "Soy", group: TagGroup.ALLERGEN },
    { key: "wheat", label: "Wheat", group: TagGroup.ALLERGEN },
    { key: "fish", label: "Fish", group: TagGroup.ALLERGEN },
    { key: "shellfish", label: "Shellfish", group: TagGroup.ALLERGEN },
    { key: "sesame", label: "Sesame", group: TagGroup.ALLERGEN },

    // Interactions
    { key: "grapefruit", label: "Grapefruit", group: TagGroup.INTERACTION },
    { key: "tyramine_rich", label: "Tyramine-rich", group: TagGroup.INTERACTION },
    { key: "vitamin_k_heavy", label: "Vitamin K-heavy", group: TagGroup.INTERACTION },
    { key: "caffeine", label: "Caffeine", group: TagGroup.INTERACTION },
    { key: "alcohol", label: "Alcohol", group: TagGroup.INTERACTION },
    { key: "licorice", label: "Licorice (glycyrrhizin)", group: TagGroup.INTERACTION },
    { key: "high_sodium", label: "High Sodium", group: TagGroup.INTERACTION },

    // Health
    { key: "ultra_processed", label: "Ultra-processed", group: TagGroup.HEALTH },
    { key: "added_sugar", label: "Added sugar", group: TagGroup.HEALTH },
    { key: "high_fiber", label: "High fiber", group: TagGroup.HEALTH },
    { key: "whole_grain", label: "Whole grain", group: TagGroup.HEALTH },
  ];

  // Upsert one-by-one (portable and idempotent)
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { key: t.key },
      create: t,
      update: { label: t.label, group: t.group },
    });
  }

  // Products
  const grapefruitJuice = await prisma.product.upsert({
    where: { upc: "000000SIMPLYGRAPE175" },
    create: {
      upc: "000000SIMPLYGRAPE175",
      brand: "Simply",
      name: "Simply Grapefruit 1.75L",
      foodType: "grapefruit juice",
    },
    update: {},
  });

  const wwBread = await prisma.product.upsert({
    where: { upc: "000000WHEATBREAD" },
    create: {
      upc: "000000WHEATBREAD",
      brand: "Generic",
      name: "Whole Wheat Bread",
      foodType: "bread",
    },
    update: {},
  });

  // Product ↔ Tag links
  const tg = await prisma.tag.findUnique({ where: { key: "grapefruit" } });
  if (tg) {
    await prisma.productTag.upsert({
      where: { productId_tagId: { productId: grapefruitJuice.id, tagId: tg.id } },
      create: { productId: grapefruitJuice.id, tagId: tg.id },
      update: {},
    });
  }

  for (const key of ["whole_grain", "high_fiber"]) {
    const t = await prisma.tag.findUnique({ where: { key } });
    if (t) {
      await prisma.productTag.upsert({
        where: { productId_tagId: { productId: wwBread.id, tagId: t.id } },
        create: { productId: wwBread.id, tagId: t.id },
        update: {},
      });
    }
  }

  console.log("Seed OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
