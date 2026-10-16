"""Categories the Photo Assistant knows, and the text prompts used for zero-shot CLIP.

The category keys match the server (server/src/models/Issue.ts). "not_civic" is extra: it catches
selfies, food, screenshots and other photos that are not a civic problem at all.
"""

CIVIC = ["pothole", "drainage", "garbage", "fallen_tree", "streetlight", "other"]
NOT_CIVIC = "not_civic"
ALL = CIVIC + [NOT_CIVIC]

LABEL = {
    "pothole": "Pothole",
    "drainage": "Drainage",
    "garbage": "Garbage",
    "fallen_tree": "Fallen tree",
    "streetlight": "Street light",
    "other": "Other civic problem",
    "not_civic": "Not a civic problem",
}

# Several phrasings per class. Their text embeddings are averaged ("prompt ensembling"),
# which is noticeably more accurate than a single prompt.
PROMPTS: dict[str, list[str]] = {
    "pothole": [
        "a photo of a pothole in the road",
        "a damaged road with a deep pothole",
        "a broken asphalt street with holes and cracks",
        "a muddy pothole filled with rain water on an Indian road",
    ],
    "drainage": [
        "a photo of a blocked drain overflowing onto the street",
        "an open sewer drain with dirty water",
        "a flooded street because of a clogged drainage",
        "a broken manhole with sewage water",
    ],
    "garbage": [
        "a photo of a garbage dump on the roadside",
        "a pile of trash and plastic waste on the street",
        "an overflowing garbage bin",
        "uncollected waste dumped in an empty plot",
    ],
    "fallen_tree": [
        "a photo of a fallen tree blocking the road",
        "a big tree branch broken and lying on the street",
        "an uprooted tree after a storm",
        "a tree that fell on a footpath",
    ],
    "streetlight": [
        "a photo of a street light pole",
        "a broken street lamp on a road",
        "a dark street at night with a street light not working",
        "a damaged lamp post with hanging wires",
    ],
    "other": [
        "a photo of a broken footpath or sidewalk",
        "a damaged public signboard",
        "a leaking water pipe on the street",
        "stagnant water and mosquitoes in a public place",
        "broken public property in a city",
    ],
    "not_civic": [
        "a selfie of a person",
        "a photo of food on a plate",
        "a screenshot of a phone screen",
        "a photo of a cat or a dog",
        "a photo of a room inside a house",
        "a photo of a document or text",
        "a blank or black image",
        "a photo of a car in a showroom",
    ],
}
