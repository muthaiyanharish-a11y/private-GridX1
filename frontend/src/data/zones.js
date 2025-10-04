const ZONES = [
  {
    id: "zone1",
    name: "Kasaragod Zone",
    center: [12.517, 75.001],
    radiusMeters: 18000,
    // small rural zone: only 1 SS
    substations: [
      { id: "z1ss1", name: "Kasaragod Town SS", coords: [12.517, 75.001] },
      { id: "z1ss2", name: "Kasaragod North SS", coords: [12.535, 75.012] }
    ]
  },
  {
    id: "zone2",
    name: "Kannur Zone",
    center: [11.874, 75.370],
    radiusMeters: 20000,
    // moderate: a few substations
    substations: [
      { id: "z2ss1", name: "Kannur City SS", coords: [11.874, 75.370] },
      { id: "z2ss2", name: "Thalassery SS", coords: [11.748, 75.492] },
      { id: "z2ss3", name: "Payyannur SS", coords: [12.101, 75.205] },
      { id: "z2ss4", name: "Iritty SS", coords: [11.966, 75.648] },
      { id: "z2ss5", name: "Thaliparamba SS", coords: [12.073, 75.356] },
      { id: "z2ss6", name: "Kuthuparamba SS", coords: [11.793, 75.516] }
    ]
  },
  {
    id: "zone3",
    name: "Kozhikode Zone",
    center: [11.258, 75.780],
    radiusMeters: 18000,
    // compact: 2 substations
    substations: [
      { id: "z3ss1", name: "Kozhikode City SS", coords: [11.258, 75.780] },
      { id: "z3ss2", name: "Vadakara SS", coords: [11.609, 75.583] }
    ]
  },
  {
    id: "zone4",
    name: "Thrissur Zone",
    center: [10.527, 76.214],
    radiusMeters: 18000,
    // larger urban zone
    substations: [
      { id: "z4ss1", name: "Thrissur City SS", coords: [10.527, 76.214] },
      { id: "z4ss2", name: "Chalakudy SS", coords: [10.304, 76.337] },
      { id: "z4ss3", name: "Kodungallur SS", coords: [10.222, 76.199] },
      { id: "z4ss4", name: "Guruvayur SS", coords: [10.594, 76.049] },
      { id: "z4ss5", name: "Kunnamkulam SS", coords: [10.522, 76.001] }
    ]
  },
  {
    id: "zone5",
    name: "Ernakulam Zone",
    center: [9.982, 76.299],
    radiusMeters: 18000,
    substations: [
      { id: "z5ss1", name: "Ernakulam City SS", coords: [9.982, 76.299] },
      { id: "z5ss2", name: "Aluva SS", coords: [10.106, 76.351] },
      { id: "z5ss3", name: "Perumbavoor SS", coords: [10.114, 76.473] },
      { id: "z5ss4", name: "Kochi Harbour SS", coords: [9.966, 76.283] }
    ]
  },
  {
    id: "zone6",
    name: "Kottayam Zone",
    center: [9.594, 76.522],
    radiusMeters: 16000,
    // very small
    substations: [
      { id: "z6ss1", name: "Kottayam Town SS", coords: [9.594, 76.522] },
      { id: "z6ss2", name: "Kottayam East SS", coords: [9.605, 76.535] }
    ]
  },
  {
    id: "zone7",
    name: "Thiruvananthapuram Zone",
    center: [8.524, 76.936],
    radiusMeters: 18000,
    // big metro
    substations: [
      { id: "z7ss1", name: "TVM City SS", coords: [8.524, 76.936] },
      { id: "z7ss2", name: "Neyyattinkara SS", coords: [8.398, 77.085] },
      { id: "z7ss3", name: "Attingal SS", coords: [8.696, 76.815] },
      { id: "z7ss4", name: "Varkala SS", coords: [8.737, 76.712] },
      { id: "z7ss5", name: "Kollam SS", coords: [8.893, 76.614] },
      { id: "z7ss6", name: "Nedumangad SS", coords: [8.607, 77.014] },
      { id: "z7ss7", name: "Kattakada SS", coords: [8.524, 77.000] }
    ]
  },
  {
    id: "zone8",
    name: "Palakkad Zone",
    center: [10.7867, 76.6548],
    radiusMeters: 17000,
    substations: [
      { id: "z8ss1", name: "Palakkad Town SS", coords: [10.7867, 76.6548] },
      { id: "z8ss2", name: "Ottapalam SS", coords: [10.7702, 76.3772] },
      { id: "z8ss3", name: "Chittur SS", coords: [10.6992, 76.7477] },
      { id: "z8ss4", name: "Shoranur SS", coords: [10.7600, 76.2711] },
      { id: "z8ss5", name: "Mannarkkad SS", coords: [10.9833, 76.4667] },
      { id: "z8ss6", name: "Alathur SS", coords: [10.6617, 76.5167] },
      { id: "z8ss7", name: "Kollengode SS", coords: [10.5767, 76.6500] },
      { id: "z8ss8", name: "Nemmara SS", coords: [10.5736, 76.6786] },
      { id: "z8ss9", name: "Pattambi SS", coords: [10.7833, 76.2833] },
      { id: "z8ss10", name: "Kongad SS", coords: [10.8083, 76.5667] }
    ]
  }
];

export default ZONES;
