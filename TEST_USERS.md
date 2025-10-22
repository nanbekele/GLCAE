# Test User Credentials

This document contains the login credentials for test users with different roles in the system.

## How to Use
1. Navigate to `/create-test-users` to create all test accounts automatically
2. Then go to `/auth/login` 
3. Use any of the email/password combinations below to test different user roles
4. Each role will redirect to their appropriate dashboard after login

## Test User Accounts

### Super Admin
- **Email:** admin@gcae.com
- **Password:** admin123
- **Role:** super_admin
- **Access:** Full system access, can manage all users and departments

### HR Staff
- **Email:** hr@gcae.com
- **Password:** hr123
- **Role:** hr_staff
- **Access:** Can manage staff registrations and employee data

### Department Heads

#### Architectural & Civil Head
- **Email:** arch.head@gcae.com
- **Password:** arch123
- **Role:** architectural_civil_head
- **Access:** Manage Architectural & Civil department projects and staff

#### Electrical Head
- **Email:** elec.head@gcae.com
- **Password:** elec123
- **Role:** electrical_head
- **Access:** Manage Electrical department projects and staff

#### Mechanical Head
- **Email:** mech.head@gcae.com
- **Password:** mech123
- **Role:** mechanical_head
- **Access:** Manage Mechanical department projects and staff

#### ICT Head
- **Email:** ict.head@gcae.com
- **Password:** ict123
- **Role:** ict_head
- **Access:** Manage ICT department projects and staff

#### Material Testing Head
- **Email:** testing.head@gcae.com
- **Password:** test123
- **Role:** material_testing_head
- **Access:** Manage Material Testing department projects and staff

#### Consultancy Head
- **Email:** consult.head@gcae.com
- **Password:** consult123
- **Role:** consultancy_head
- **Access:** Manage Consultancy department projects and staff

### Marketing Communications
- **Email:** marketing@gcae.com
- **Password:** marketing123
- **Role:** marketing_communications
- **Access:** Manage marketing content, messages, and communications

### Employee
- **Email:** employee@gcae.com
- **Password:** emp123
- **Role:** employee
- **Access:** Basic employee dashboard with project access

### Client
- **Email:** client@gcae.com
- **Password:** client123
- **Role:** client
- **Access:** Client portal with project viewing and inquiry submission

## Testing Instructions

1. **Create Test Users:** Visit `/create-test-users` to automatically create all test accounts
2. **Login Testing:** Use any of the above credentials at `/auth/login`
3. **Role-based Access:** Each user will be redirected to their appropriate dashboard
4. **Registration Testing:** Test new user registration at `/auth/register`

## Important Notes

- All test accounts are pre-configured and ready to use
- Client users who register normally will be redirected to the client dashboard
- Staff registration requires HR or Super Admin access
- Test data persists between sessions for development testing