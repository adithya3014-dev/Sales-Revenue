const CATEGORY_TAXONOMY = [
  {
    category: 'Electronics',
    description: 'Devices and technology for work, home, and entertainment.',
    subcategories: [
      { name: 'Electronic Devices', items: ['Smartphones', 'Tablets', 'Smartwatches'] },
      { name: 'Audio & Video', items: ['Headphones', 'Speakers', 'Televisions'] },
      { name: 'Cameras & Photography', items: ['Digital cameras', 'Webcams', 'Camera lenses'] },
      { name: 'Smart Home', items: ['Smart lights', 'Security cameras', 'Smart plugs'] },
      { name: 'Electronic Accessories', items: ['Chargers', 'Power banks', 'Cables'] }
    ]
  },
  {
    category: 'Computers',
    description: 'Computing devices, components, and networking equipment.',
    subcategories: [
      { name: 'Laptops & Desktops', items: ['Business laptops', 'Gaming desktops', 'Mini PCs'] },
      { name: 'Monitors', items: ['4K monitors', 'Ultrawide monitors', 'Portable monitors'] },
      { name: 'Computer Peripherals', items: ['Keyboards', 'Mice', 'Webcams'] },
      { name: 'Components', items: ['Processors', 'Graphics cards', 'Memory & storage'] },
      { name: 'Networking', items: ['Routers', 'Network switches', 'Wi-Fi adapters'] }
    ]
  },
  {
    category: 'Furniture',
    description: 'Furniture for offices, homes, and shared workspaces.',
    subcategories: [
      { name: 'Desks & Tables', items: ['Standing desks', 'Executive desks', 'Conference tables'] },
      { name: 'Office Chairs', items: ['Ergonomic chairs', 'Task chairs', 'Guest chairs'] },
      { name: 'Living Room', items: ['Sofas', 'Coffee tables', 'TV stands'] },
      { name: 'Bedroom', items: ['Beds', 'Dressers', 'Bedside tables'] },
      { name: 'Shelving', items: ['Bookcases', 'Wall shelves', 'Display units'] }
    ]
  },
  {
    category: 'Accessories',
    description: 'Useful add-ons for technology, work, and everyday life.',
    subcategories: [
      { name: 'Computer Accessories', items: ['USB-C hubs', 'Laptop stands', 'Mouse pads'] },
      { name: 'Mobile Accessories', items: ['Phone cases', 'Screen protectors', 'Car mounts'] },
      { name: 'Bags & Cases', items: ['Laptop bags', 'Backpacks', 'Travel cases'] },
      { name: 'Power & Cables', items: ['Adapters', 'Extension cords', 'Charging cables'] }
    ]
  },
  {
    category: 'Office',
    description: 'Everyday supplies and equipment for productive work.',
    subcategories: [
      { name: 'Paper & Notebooks', items: ['Copy paper', 'Notebooks', 'Sticky notes'] },
      { name: 'Writing Supplies', items: ['Pens', 'Pencils', 'Markers'] },
      { name: 'Desk Supplies', items: ['Staplers', 'Desk organizers', 'Scissors'] },
      { name: 'Printing', items: ['Printers', 'Ink cartridges', 'Labels'] },
      { name: 'Presentation', items: ['Projectors', 'Whiteboards', 'Presentation remotes'] }
    ]
  },
  {
    category: 'Storage',
    description: 'Storage and organization solutions for every space.',
    subcategories: [
      { name: 'Storage Furniture', items: ['Filing cabinets', 'Storage cabinets', 'Bookcases'] },
      { name: 'Containers & Bins', items: ['Storage bins', 'Document boxes', 'Drawer organizers'] },
      { name: 'Closet Organization', items: ['Hangers', 'Shoe racks', 'Closet shelves'] },
      { name: 'File & Document Storage', items: ['File folders', 'Binders', 'Archive boxes'] }
    ]
  },
  {
    category: 'Home & Kitchen',
    description: 'Appliances, cookware, and essentials for the home.',
    subcategories: [
      { name: 'Kitchen Appliances', items: ['Coffee makers', 'Blenders', 'Air fryers'] },
      { name: 'Cookware & Dining', items: ['Cookware sets', 'Dinnerware', 'Drinkware'] },
      { name: 'Home Decor', items: ['Lighting', 'Wall art', 'Rugs'] },
      { name: 'Cleaning', items: ['Vacuum cleaners', 'Mops', 'Cleaning tools'] }
    ]
  },
  {
    category: 'Clothing & Apparel',
    description: 'Clothing, footwear, and accessories for all occasions.',
    subcategories: [
      { name: "Men's Clothing", items: ['Shirts', 'Trousers', 'Jackets'] },
      { name: "Women's Clothing", items: ['Tops', 'Dresses', 'Outerwear'] },
      { name: 'Footwear', items: ['Casual shoes', 'Athletic shoes', 'Boots'] },
      { name: 'Bags & Accessories', items: ['Belts', 'Wallets', 'Handbags'] }
    ]
  },
  {
    category: 'Sports & Outdoors',
    description: 'Equipment and gear for sports, fitness, and outdoor activities.',
    subcategories: [
      { name: 'Fitness Equipment', items: ['Dumbbells', 'Yoga mats', 'Resistance bands'] },
      { name: 'Team Sports', items: ['Basketballs', 'Soccer balls', 'Protective gear'] },
      { name: 'Camping & Hiking', items: ['Tents', 'Sleeping bags', 'Hiking backpacks'] },
      { name: 'Cycling', items: ['Bicycles', 'Helmets', 'Bike accessories'] }
    ]
  },
  {
    category: 'Beauty & Personal Care',
    description: 'Personal grooming, skincare, and beauty essentials.',
    subcategories: [
      { name: 'Skincare', items: ['Cleansers', 'Moisturizers', 'Sunscreen'] },
      { name: 'Hair Care', items: ['Shampoo', 'Hair dryers', 'Styling tools'] },
      { name: 'Makeup', items: ['Foundation', 'Lip color', 'Brush sets'] },
      { name: 'Personal Grooming', items: ['Shavers', 'Trimmers', 'Electric toothbrushes'] }
    ]
  },
  {
    category: 'Health & Wellness',
    description: 'Wellness products and personal health essentials.',
    subcategories: [
      { name: 'Health Monitors', items: ['Blood pressure monitors', 'Thermometers', 'Scales'] },
      { name: 'Mobility & Support', items: ['Walking aids', 'Braces & supports', 'Compression wear'] },
      { name: 'First Aid', items: ['First aid kits', 'Bandages', 'Emergency supplies'] },
      { name: 'Wellness Equipment', items: ['Massage devices', 'Air purifiers', 'Sleep aids'] }
    ]
  },
  {
    category: 'Grocery & Food',
    description: 'Pantry goods, beverages, and everyday food essentials.',
    subcategories: [
      { name: 'Pantry Staples', items: ['Grains', 'Pasta', 'Cooking oils'] },
      { name: 'Snacks', items: ['Chips', 'Nuts', 'Snack bars'] },
      { name: 'Beverages', items: ['Coffee', 'Tea', 'Juices'] },
      { name: 'Baking', items: ['Flour', 'Baking mixes', 'Decorating supplies'] }
    ]
  },
  {
    category: 'Automotive',
    description: 'Vehicle maintenance products, accessories, and tools.',
    subcategories: [
      { name: 'Car Accessories', items: ['Floor mats', 'Phone holders', 'Seat covers'] },
      { name: 'Vehicle Electronics', items: ['Dash cameras', 'Car audio', 'GPS devices'] },
      { name: 'Tools & Maintenance', items: ['Tool kits', 'Battery chargers', 'Tire inflators'] },
      { name: 'Cleaning & Care', items: ['Car wash kits', 'Polishes', 'Interior cleaners'] }
    ]
  },
  {
    category: 'Books & Media',
    description: 'Books, educational resources, and entertainment media.',
    subcategories: [
      { name: 'Books', items: ['Business books', 'Fiction', "Children's books"] },
      { name: 'Educational Materials', items: ['Textbooks', 'Workbooks', 'Reference guides'] },
      { name: 'Music & Movies', items: ['Vinyl records', 'Music media', 'Movie collections'] },
      { name: 'Digital Media', items: ['E-readers', 'Digital subscriptions', 'Audio books'] }
    ]
  },
  {
    category: 'Toys & Games',
    description: 'Toys, games, and creative activities for all ages.',
    subcategories: [
      { name: 'Board Games', items: ['Family games', 'Strategy games', 'Card games'] },
      { name: 'Building & Construction', items: ['Building blocks', 'Model kits', 'Construction sets'] },
      { name: 'Outdoor Toys', items: ['Scooters', 'Kites', 'Playground toys'] },
      { name: 'Arts & Crafts', items: ['Craft kits', 'Drawing supplies', 'Modeling clay'] }
    ]
  },
  {
    category: 'Pet Supplies',
    description: 'Food, accessories, and care products for pets.',
    subcategories: [
      { name: 'Pet Food', items: ['Dry food', 'Wet food', 'Treats'] },
      { name: 'Toys & Enrichment', items: ['Chew toys', 'Interactive toys', 'Scratching posts'] },
      { name: 'Beds & Carriers', items: ['Pet beds', 'Travel carriers', 'Crates'] },
      { name: 'Grooming & Care', items: ['Brushes', 'Shampoos', 'Cleaning supplies'] }
    ]
  },
  {
    category: 'Garden & Outdoor Living',
    description: 'Supplies for gardening, patios, and outdoor living spaces.',
    subcategories: [
      { name: 'Garden Tools', items: ['Hand tools', 'Pruners', 'Watering cans'] },
      { name: 'Planters & Pots', items: ['Indoor planters', 'Outdoor pots', 'Raised beds'] },
      { name: 'Outdoor Furniture', items: ['Patio chairs', 'Outdoor tables', 'Hammocks'] },
      { name: 'Lawn & Irrigation', items: ['Hoses', 'Sprinklers', 'Lawn tools'] }
    ]
  }
];

export default CATEGORY_TAXONOMY;
