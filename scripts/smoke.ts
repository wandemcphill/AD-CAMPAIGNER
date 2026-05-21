import { platformEvents } from "@fliptrybe/events";
import { createMockAdsProvider } from "@fliptrybe/providers";

async function main() {
  const provider = createMockAdsProvider();
  const eventNames = platformEvents.map((event) => event.name);

  if (!eventNames.includes("CampaignCreated")) {
    throw new Error("CampaignCreated event contract is missing");
  }

  const quote = await provider.quoteCampaign({
    objective: "ENGAGEMENT",
    budgetMinor: 500000,
    currency: "NGN",
    destinationKind: "INSTAGRAM_REEL"
  });

  if (quote.estimatedReach.min <= 0) {
    throw new Error("Mock ads provider returned an invalid reach estimate");
  }

  console.log("Smoke checks passed", {
    events: eventNames.length,
    mockReach: quote.estimatedReach
  });
}

void main();
