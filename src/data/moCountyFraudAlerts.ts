export type FraudAlertCounty = {
  slug: string;
  name: string;
  recorder: string;
  signupUrl: string;
  description: string;
  phone?: string;
};

export const MO_COUNTY_FRAUD_ALERTS: FraudAlertCounty[] = [
  {
    slug: "stl-city",
    name: "St. Louis City",
    recorder: "St. Louis City Recorder of Deeds",
    signupUrl: "https://www.propertyfraudalert.com/MOCityofStLouis",
    description:
      "Free email notifications from the City Recorder whenever a document is recorded under your name.",
    phone: "(314) 622-3260",
  },
  {
    slug: "stl-county",
    name: "St. Louis County",
    recorder: "St. Louis County Recorder of Deeds",
    signupUrl: "https://stlouiscountymo.gov/st-louis-county-departments/recorder-of-deeds/property-fraud-alert/",
    description:
      "County-run Property Fraud Alert service, free for any property owner in St. Louis County.",
  },
  {
    slug: "st-charles",
    name: "St. Charles County",
    recorder: "St. Charles County Recorder of Deeds",
    signupUrl: "https://www.propertyfraudalert.com/",
    description:
      "Sign up via the national Property Fraud Alert portal and select St. Charles County, MO.",
  },
  {
    slug: "jackson",
    name: "Jackson County (Kansas City)",
    recorder: "Jackson County Recorder of Deeds",
    signupUrl: "https://www.propertyfraudalert.com/",
    description:
      "Free alerts for Jackson County property owners through the Recorder's office.",
  },
  {
    slug: "greene",
    name: "Greene County (Springfield)",
    recorder: "Greene County Recorder of Deeds",
    signupUrl: "https://www.propertyfraudalert.com/",
    description:
      "Free alerts for Greene County property owners through the Recorder's office.",
  },
  {
    slug: "other",
    name: "Other Missouri county",
    recorder: "Property Fraud Alert (nationwide portal)",
    signupUrl: "https://www.propertyfraudalert.com/",
    description:
      "Most Missouri counties participate in the national Property Fraud Alert service. Search for your county after signing up.",
  },
];
