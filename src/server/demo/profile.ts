// src/server/demo/profile.ts
export const DEMO_PROFILE = {
  displayName: "Test 123",
  age: 34,
  zip: "94110",
  conditions: ["high cholesterol", "seasonal allergies"],
  medications: ["atorvastatin 20 mg nightly"],   // gives you the grapefruit red-flag
  allergies: ["peanut", "wheat"],                 // triggers allergen flags
  goals: ["high_fiber", "budget", "whole_grain"],
  preferences: { diet: "no strict diet", caffeine_ok: true, alcohol_ok: true, cooking_time_minutes: 20 },
  notes: "Avoid grapefruit with statins; likes quick breakfasts."
};
