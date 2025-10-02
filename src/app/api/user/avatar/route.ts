import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, supabaseServer } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    console.log('📸 Avatar upload request received');
    
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    console.log('✅ User authenticated:', user.id);

    const formData = await request.formData();
    const file = formData.get('avatar') as File;
    
    console.log('📁 File received:', file?.name, file?.size, file?.type);
    
    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('❌ Invalid file type:', file.type);
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.log('❌ File too large:', file.size);
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename with user folder structure
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    console.log('📤 Uploading file:', filePath);

    // Check if avatars bucket exists (bucket should already exist from SQL script)
    console.log('🪣 Checking avatars bucket...');
    const { data: buckets, error: bucketsError } = await supabaseServer.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return NextResponse.json(
        { error: "Storage service unavailable" },
        { status: 500 }
      );
    }

    const avatarsBucket = buckets?.find(bucket => bucket.name === 'avatars');
    
    if (!avatarsBucket) {
      console.error('❌ Avatars bucket not found. Please run the avatar-storage.sql script first.');
      return NextResponse.json(
        { error: "Storage bucket not configured. Please contact support." },
        { status: 500 }
      );
    }
    
    console.log('✅ Avatars bucket found:', avatarsBucket);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ File uploaded successfully:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;
    console.log('🔗 Avatar URL generated:', avatarUrl);

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_path: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    console.log('✅ Profile updated with new avatar URL');
    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl
    });

  } catch (error) {
    console.error("❌ Avatar upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
