// @ts-nocheck
// Deno Edge Function: disable TypeScript checking in IDE to avoid Node resolver errors for URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface TestUser {
  email: string;
  password: string;
  full_name: string;
  role: string;
  department?: string;
}

const testUsers: TestUser[] = [
  // Super Admin
  {
    email: "admin@gcae.com",
    password: "admin123",
    full_name: "System Administrator",
    role: "super_admin"
  },
  // HR Staff
  {
    email: "hr@gcae.com", 
    password: "hr123",
    full_name: "HR Manager",
    role: "hr_staff"
  },
  // Department Heads
  {
    email: "arch.head@gcae.com",
    password: "arch123", 
    full_name: "Architecture Head",
    role: "architectural_civil_head",
    department: "Architectural & Civil"
  },
  {
    email: "elec.head@gcae.com",
    password: "elec123",
    full_name: "Electrical Head", 
    role: "electrical_head",
    department: "Electrical"
  },
  {
    email: "mech.head@gcae.com",
    password: "mech123",
    full_name: "Mechanical Head",
    role: "mechanical_head", 
    department: "Mechanical"
  },
  {
    email: "ict.head@gcae.com",
    password: "ict123",
    full_name: "ICT Head",
    role: "ict_head",
    department: "ICT"
  },
  {
    email: "testing.head@gcae.com",
    password: "test123",
    full_name: "Material Testing Head",
    role: "material_testing_head",
    department: "Material Testing"
  },
  {
    email: "consult.head@gcae.com", 
    password: "consult123",
    full_name: "Consultancy Head",
    role: "consultancy_head",
    department: "Consultancy"
  },
  // Marketing Communications
  {
    email: "marketing@gcae.com",
    password: "marketing123", 
    full_name: "Marketing Manager",
    role: "marketing_communications"
  },
  // Employee
  {
    email: "employee@gcae.com",
    password: "emp123",
    full_name: "Staff Employee",
    role: "employee",
    department: "Architectural & Civil"
  },
  // Client
  {
    email: "client@gcae.com",
    password: "client123",
    full_name: "Test Client",
    role: "client"
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce POST for execution
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: 'created' | 'updated' | 'error'; message: string }[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const testUser of testUsers) {
      try {
        console.log(`Provisioning test user: ${testUser.email}`);

        const email = testUser.email.toLowerCase();
        const isClient = testUser.role === 'client';

        const { data: existingProfile, error: profileLookupError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (profileLookupError) {
          throw new Error(`Profile lookup failed: ${profileLookupError.message}`);
        }

        const { data: hashValue, error: hashError } = await supabase.rpc('hash_password', {
          p_password: testUser.password,
        });

        if (hashError || !hashValue) {
          const reason = hashError?.message ?? 'Failed to hash password';
          throw new Error(reason);
        }

        let userId = existingProfile?.user_id ?? null;

        if (!userId) {
          const { data: insertResult, error: insertError } = await supabase
            .from('profiles')
            .insert({
              full_name: testUser.full_name,
              email,
              phone: null,
              role: testUser.role,
              department: testUser.department ?? null,
              password_hash: hashValue,
              is_active: true,
            })
            .select('user_id')
            .maybeSingle();

          if (insertError) {
            throw new Error(`Profile insert failed: ${insertError.message}`);
          }

          if (!insertResult?.user_id) {
            throw new Error('Profile insert did not return a user_id');
          }

          userId = insertResult.user_id;

          if (!isClient) {
            const { error: staffInsertError } = await supabase
              .from('staff_registrations')
              .insert({
                user_id: userId,
                username: email.split('@')[0],
                full_name: testUser.full_name,
                email,
                department: testUser.department ?? '',
                role: testUser.role,
                position: testUser.department ?? null,
                employment_date: new Date().toISOString().slice(0, 10),
                is_activated: true,
              });

            if (staffInsertError) {
              throw new Error(`Staff insert failed: ${staffInsertError.message}`);
            }
          }

          createdCount++;
          results.push({
            email,
            status: 'created',
            message: 'User created successfully',
          });
          continue;
        }

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            full_name: testUser.full_name,
            role: testUser.role,
            department: testUser.department ?? null,
            password_hash: hashValue,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (profileUpdateError) {
          throw new Error(`Profile refresh failed: ${profileUpdateError.message}`);
        }

        if (!isClient) {
          const { error: staffUpsertError } = await supabase
            .from('staff_registrations')
            .upsert({
              user_id: userId,
              username: email.split('@')[0],
              full_name: testUser.full_name,
              email,
              department: testUser.department ?? '',
              role: testUser.role,
              position: testUser.department ?? null,
              employment_date: new Date().toISOString().slice(0, 10),
              is_activated: true,
            }, { onConflict: 'user_id' });

          if (staffUpsertError) {
            throw new Error(`Staff record refresh failed: ${staffUpsertError.message}`);
          }
        }

        updatedCount++;
        results.push({
          email,
          status: 'updated',
          message: 'Existing user refreshed successfully',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        console.error(`Unexpected error provisioning user ${testUser.email}:`, message);
        results.push({
          email: testUser.email,
          status: 'error',
          message,
        });
        errorCount++;
      }
    }

    const successTotal = createdCount + updatedCount;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test users provisioning completed. Created: ${createdCount}, Updated: ${updatedCount}, Errors: ${errorCount}`,
        results,
        summary: {
          total: testUsers.length,
          created: createdCount,
          updated: updatedCount,
          errors: errorCount,
          successful: successTotal,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});