# GCAE - GUBALAFTO Consulting Architects and Engineers

## Project Overview

Leading construction and IT consultancy in East Africa. GCAE delivers excellence in architectural, engineering, and ICT solutions. A MIDROC Investment Group company.

## How to Run

### Prerequisites
- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Supabase CLI (for local development)

### Local Development

```sh
# Step 1: Navigate to the project directory.
cd gcae-vision-hub-main

# Step 2: Install the necessary dependencies.
npm i

# Step 3: Start the development server with Supabase local stack.
npm run local:up
```

Or for cloud Supabase:
```sh
npm run cloud:up
```

Or frontend only:
```sh
npm run dev
```

### Stop Local Supabase
```sh
npm run local:down
```

## Technologies Used

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase
- React Router
- TanStack Query
