/* ── PRODUCTS ──────────────────────────────────────────────
   The fallback catalogue. Once Supabase has one, the products
   table wins and this list is what the shop falls back to if
   the database cannot be reached — so a bad connection shows a
   full shop rather than an empty one.

   img : put photos in assets/images/ and write the path here.
         img:null draws the design instead of showing a photo.
   ───────────────────────────────────────────────────────── */
const PRODUCTS = [
  { id:"nazar", name:"Nazar Evil Eye Rakhi", price:59, mrp:99, cat:"evil-eye", feat:1,
    img:"../../assets/images/nazar-rakhi.jpg",
    desc:"Turquoise silk thread, two bands of white seed beads, a hand-painted eye set in a gold-tone frame.",
    art:{thread:"#3BC4DE", bead:"#FDFCF7", charm:"nazar"} },
  { id:"pearl", name:"Pearl Bead Rakhi", price:49, mrp:79, cat:"pearl", feat:2, img:null,
    desc:"A full cluster of white pearl beads on red and gold thread. Plain enough for anyone.",
    art:{thread:"#C0272D", bead:"#FDFCF7", charm:"moti"} },
  { id:"om", name:"Om Kalava Rakhi", price:39, mrp:69, cat:"traditional", feat:3, img:null,
    desc:"Plain red and yellow kalava with a gold-tone Om. The simplest thing we make.",
    art:{thread:"#D4A017", bead:"#C0272D", charm:"om"} },
  { id:"rudra", name:"Rudraksh Rakhi", price:79, mrp:129, cat:"traditional", feat:4, img:null,
    desc:"A real rudraksh bead on ochre thread. For brothers who dislike anything shiny.",
    art:{thread:"#C97B2E", bead:"#E8D9B8", charm:"rudraksh"} },
  { id:"kids", name:"Kids Bright Rakhi", price:49, mrp:79, cat:"kids", feat:5, img:null,
    desc:"Soft thread, bright colours, a star in the middle. Light enough for a small wrist.",
    art:{thread:"#2F8F4E", bead:"#FFD447", charm:"star"} },
  { id:"lumba", name:"Bhabhi Lumba Rakhi", price:99, mrp:149, cat:"lumba", feat:6, img:null,
    desc:"Hangs from a bangle instead of tying to the wrist. Flower charm with a bead drop.",
    art:{thread:"#B5179E", bead:"#FFD447", charm:"ful"} },
  { id:"swastik", name:"Swastik Thread Rakhi", price:45, mrp:79, cat:"traditional", feat:7, img:null,
    desc:"Red swastik on cream enamel, saffron thread. Usually bought for the puja thali.",
    art:{thread:"#E2762B", bead:"#E5B84B", charm:"swastik"} },
  { id:"heart", name:"Heart Charm Rakhi", price:55, mrp:89, cat:"kids", feat:8, img:null,
    desc:"Red heart on pink thread with gold beads. Doubles as a friendship band.",
    art:{thread:"#E0507F", bead:"#E5B84B", charm:"dil"} },
  { id:"set2", name:"Bhaiya–Bhabhi Set", price:149, mrp:229, cat:"lumba", feat:9, img:null,
    desc:"One rakhi for bhaiya, one matching lumba for bhabhi, in the same colour family.",
    art:{thread:"#C0272D", bead:"#FFD447", charm:"dil"} },
  { id:"silver", name:"Silver-Look Flower Rakhi", price:199, mrp:299, cat:"premium", feat:10, img:null,
    desc:"Silver-plated flower on maroon velvet thread. Arrives in a small gift box.",
    art:{thread:"#7A1F3D", bead:"#E6E8EA", charm:"ful"} },
  { id:"kundan", name:"Gold Kundan Rakhi", price:249, mrp:399, cat:"premium", feat:11, img:null,
    desc:"Kundan stones set in a gold-tone frame on deep navy thread. Comes in a velvet pouch.",
    art:{thread:"#274B9F", bead:"#E5B84B", charm:"ful"} },
  { id:"zardosi", name:"Royal Zardosi Rakhi", price:349, mrp:499, cat:"premium", feat:12, img:null,
    desc:"Zardosi embroidery on maroon silk with real glass beads. Gift-boxed with roli and chawal.",
    art:{thread:"#7A1F3D", bead:"#E5B84B", charm:"rudraksh"} }
];

const CATS = [
  {k:"all", n:"Everything"}, {k:"evil-eye", n:"Evil eye"}, {k:"pearl", n:"Pearl"},
  {k:"traditional", n:"Traditional"}, {k:"kids", n:"Kids"},
  {k:"lumba", n:"Bhabhi & sets"}, {k:"premium", n:"Premium"}
];

const SETS = [
  { id:"s2", name:"Two Rakhi Pack", price:99, was:118, best:false,
    items:["Any two rakhis","Roli–chawal sachet","A card, written by hand"] },
  { id:"s4", name:"Family Pack of Four", price:179, was:236, best:true,
    items:["Any four rakhis","Roli–chawal and mishri","Four cards, a name on each","Delivery free"] }
];

/* thread colours and centre pieces actually in stock */
const THREADS = [
  {n:"Turquoise", c:"#3BC4DE"}, {n:"Red", c:"#C0272D"}, {n:"Yellow", c:"#E8B01F"},
  {n:"Pink", c:"#E0507F"}, {n:"Green", c:"#2F8F4E"}, {n:"Navy", c:"#274B9F"},
  {n:"Saffron", c:"#E2762B"}, {n:"Maroon", c:"#7A1F3D"}, {n:"White", c:"#F2F0EA"}
];
const CHARMS = [
  {k:"nazar", n:"Evil eye"}, {k:"moti", n:"Pearl cluster"}, {k:"rudraksh", n:"Rudraksh"},
  {k:"om", n:"Om"}, {k:"swastik", n:"Swastik"}, {k:"ful", n:"Flower"},
  {k:"star", n:"Star"}, {k:"dil", n:"Heart"}
];
