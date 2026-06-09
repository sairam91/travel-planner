export interface Hotel {
  id: string;
  name: string;
  stars: number;
  pricePerNight: number;
  currency: string;
  neighborhood: string;
  amenities: string[];
  rating: number;
  reviewCount: number;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  duration: string;
  price: number | null;
  currency: string;
  description: string;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  description: string;
  mustSee: boolean;
}

export interface RentalCar {
  id: string;
  company: string;
  carType: string;
  carModel: string;
  pricePerDay: number;
  currency: string;
  features: string[];
  rating: number;
  reviewCount: number;
}

export interface DestinationData {
  hotels: Hotel[];
  activities: Activity[];
  places: Place[];
  rentalCars: RentalCar[];
}

const destinations: Record<string, DestinationData> = {
  default: {
    hotels: [
      {
        id: "h1",
        name: "The Grand Palais",
        stars: 5,
        pricePerNight: 320,
        currency: "USD",
        neighborhood: "City Centre",
        amenities: ["Pool", "Spa", "Free WiFi", "Restaurant"],
        rating: 4.8,
        reviewCount: 2341,
      },
      {
        id: "h2",
        name: "Boutique Nest",
        stars: 4,
        pricePerNight: 175,
        currency: "USD",
        neighborhood: "Old Quarter",
        amenities: ["Free WiFi", "Breakfast", "Bar"],
        rating: 4.6,
        reviewCount: 987,
      },
      {
        id: "h3",
        name: "Urban Lodge",
        stars: 3,
        pricePerNight: 95,
        currency: "USD",
        neighborhood: "Arts District",
        amenities: ["Free WiFi", "Gym"],
        rating: 4.3,
        reviewCount: 512,
      },
      {
        id: "h4",
        name: "Harbour View Suites",
        stars: 4,
        pricePerNight: 210,
        currency: "USD",
        neighborhood: "Waterfront",
        amenities: ["Sea View", "Pool", "Free WiFi", "Concierge"],
        rating: 4.7,
        reviewCount: 1204,
      },
    ],
    activities: [
      {
        id: "a1",
        name: "City Walking Tour",
        category: "Culture",
        duration: "3 hrs",
        price: 25,
        currency: "USD",
        description: "Explore the historic streets and hidden gems with a local guide.",
      },
      {
        id: "a2",
        name: "Cooking Class",
        category: "Food & Drink",
        duration: "4 hrs",
        price: 80,
        currency: "USD",
        description: "Learn to prepare traditional local dishes from a master chef.",
      },
      {
        id: "a3",
        name: "Sunset Kayaking",
        category: "Outdoor",
        duration: "2 hrs",
        price: 55,
        currency: "USD",
        description: "Paddle along the coastline as the sun dips below the horizon.",
      },
      {
        id: "a4",
        name: "Night Market Visit",
        category: "Food & Drink",
        duration: "2 hrs",
        price: null,
        currency: "USD",
        description: "Wander through vibrant stalls of street food and local crafts.",
      },
      {
        id: "a5",
        name: "Bike the Countryside",
        category: "Outdoor",
        duration: "5 hrs",
        price: 40,
        currency: "USD",
        description: "Cycle through scenic rural landscapes and quaint villages.",
      },
    ],
    places: [
      {
        id: "p1",
        name: "The Old Citadel",
        type: "Landmark",
        description: "A UNESCO World Heritage fortress offering panoramic views of the city.",
        mustSee: true,
      },
      {
        id: "p2",
        name: "Central Market Hall",
        type: "Market",
        description: "A 19th-century iron-and-glass market overflowing with local produce.",
        mustSee: true,
      },
      {
        id: "p3",
        name: "Museum of Modern Art",
        type: "Museum",
        description: "Award-winning gallery spanning contemporary works from across the region.",
        mustSee: false,
      },
      {
        id: "p4",
        name: "Botanical Gardens",
        type: "Nature",
        description: "Sprawling gardens home to over 10,000 plant species from five continents.",
        mustSee: false,
      },
      {
        id: "p5",
        name: "Harbour Promenade",
        type: "Landmark",
        description: "A beloved waterfront esplanade lined with cafés, sculptures, and sea views.",
        mustSee: true,
      },
    ],
    rentalCars: [
      {
        id: "rc1",
        company: "Enterprise",
        carType: "SUV",
        carModel: "Toyota RAV4 or similar",
        pricePerDay: 85,
        currency: "USD",
        features: ["GPS", "AC", "Unlimited mileage", "Bluetooth"],
        rating: 4.6,
        reviewCount: 3120,
      },
      {
        id: "rc2",
        company: "Hertz",
        carType: "Economy",
        carModel: "Toyota Corolla or similar",
        pricePerDay: 48,
        currency: "USD",
        features: ["AC", "Unlimited mileage", "USB charging"],
        rating: 4.4,
        reviewCount: 2085,
      },
      {
        id: "rc3",
        company: "Budget",
        carType: "Compact",
        carModel: "Honda Civic or similar",
        pricePerDay: 38,
        currency: "USD",
        features: ["AC", "Fuel efficient", "USB charging"],
        rating: 4.2,
        reviewCount: 1543,
      },
      {
        id: "rc4",
        company: "Avis",
        carType: "Minivan",
        carModel: "Chrysler Pacifica or similar",
        pricePerDay: 110,
        currency: "USD",
        features: ["GPS", "AC", "7 seats", "Unlimited mileage", "Bluetooth"],
        rating: 4.7,
        reviewCount: 876,
      },
    ],
  },
};

export function getDestinationData(_destination: string): DestinationData {
  return destinations["default"];
}
