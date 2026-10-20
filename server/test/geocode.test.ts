import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { photonToPlace } from "../src/utils/geocode";

// Shape of a real Photon (photon.komoot.io) result.
test("a Photon result becomes a short and a full address", () => {
  const place = photonToPlace({
    geometry: { coordinates: [78.4482, 17.4374] },
    properties: { name: "Ameerpet Metro Station", street: "Ameerpet Main Road", district: "Ameerpet", city: "Hyderabad", state: "Telangana", postcode: "500016", country: "India", countrycode: "IN" },
  });
  assert.deepEqual(place, {
    label: "Ameerpet Metro Station, Ameerpet Main Road, Ameerpet",
    full: "Ameerpet Metro Station, Ameerpet Main Road, Ameerpet, Hyderabad, Telangana, 500016, India",
    lat: 17.4374,
    lng: 78.4482,
  });
});

test("a Photon street result without a name uses the house number and street", () => {
  const place = photonToPlace({ geometry: { coordinates: [78.5, 17.4] }, properties: { housenumber: "12", street: "MG Road", city: "Hyderabad" } });
  assert.equal(place?.label, "12 MG Road, Hyderabad");
});

test("Photon results without coordinates or any name are skipped", () => {
  assert.equal(photonToPlace({ properties: { name: "Nowhere" } }), null);
  assert.equal(photonToPlace({ geometry: { coordinates: [78.5, 17.4] }, properties: {} }), null);
});
