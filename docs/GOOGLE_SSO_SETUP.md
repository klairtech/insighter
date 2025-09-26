# Google SSO Setup Guide for Supabase

This guide will walk you through setting up Google Single Sign-On (SSO) for your Insighter application using Supabase.

## Prerequisites

- A Google Cloud Platform (GCP) account
- A Supabase project
- Access to your Supabase dashboard

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "Insighter App")
5. Click "Create"

## Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and then click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen first:

   - Choose "External" user type
   - Fill in the required fields:
     - App name: "Insighter"
     - User support email: Your email
     - Developer contact information: Your email
   - Add your domain to "Authorized domains"
   - Save and continue through the scopes and test users sections

4. For the OAuth client:

   - Application type: "Web application"
   - Name: "Insighter Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `https://your-supabase-project-ref.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for development)

5. Click "Create"
6. Copy the **Client ID** and **Client Secret** - you'll need these for Supabase

## Step 4: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Authentication" > "Providers"
4. Find "Google" in the list and click on it
5. Toggle "Enable sign in with Google" to ON
6. Enter your Google OAuth credentials:
   - **Client ID**: The Client ID from Step 3
   - **Client Secret**: The Client Secret from Step 3
7. Click "Save"

## Step 5: Configure Redirect URLs

1. In your Supabase dashboard, go to "Authentication" > "URL Configuration"
2. Add your redirect URLs:
   - **Site URL**: `http://localhost:3000` (development) or `https://yourdomain.com` (production)
   - **Redirect URLs**:
     - `http://localhost:3000/organizations` (development)
     - `https://yourdomain.com/organizations` (production)

## Step 6: Environment Variables

Make sure your `.env.local` file contains the correct Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Step 7: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000/login`
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you should be redirected back to your app

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**:

   - Ensure the redirect URI in Google Console exactly matches your Supabase callback URL
   - Check that there are no trailing slashes or extra characters

2. **"invalid_client" error**:

   - Verify your Client ID and Client Secret are correct in Supabase
   - Make sure the OAuth consent screen is properly configured

3. **"access_denied" error**:

   - Check that your domain is added to authorized domains in Google Console
   - Ensure the OAuth consent screen is published (not in testing mode for production)

4. **User not created in database**:
   - Check your Supabase RLS policies
   - Ensure the `users` table allows inserts from authenticated users

### Development vs Production

For production deployment:

1. Update the authorized origins and redirect URIs in Google Console
2. Update the Site URL and Redirect URLs in Supabase
3. Make sure your OAuth consent screen is published (not in testing mode)
4. Add your production domain to authorized domains

## Security Best Practices

1. **Never commit secrets**: Keep your Client Secret secure and never commit it to version control
2. **Use environment variables**: Store sensitive configuration in environment variables
3. **Regular rotation**: Periodically rotate your OAuth credentials
4. **Monitor usage**: Keep an eye on your Google Cloud Console for unusual activity
5. **HTTPS only**: Always use HTTPS in production

## Additional Configuration

### Custom Scopes

If you need additional user information, you can request additional scopes in your Supabase configuration:

```javascript
// In your Supabase auth configuration
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    scopes: "openid email profile",
    redirectTo: `${window.location.origin}/organizations`,
  },
});
```

### User Metadata

Google OAuth provides user information that gets stored in the user's metadata:

```javascript
// Access user information after sign-in
const user = supabase.auth.getUser();
console.log(user.user_metadata); // Contains name, picture, etc.
```

## Support

If you encounter issues:

1. Check the [Supabase Auth documentation](https://supabase.com/docs/guides/auth)
2. Review the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2)
3. Check your browser's developer console for error messages
4. Verify your configuration matches the examples above

## Next Steps

After setting up Google SSO:

1. Test the complete authentication flow
2. Implement user profile management
3. Set up proper error handling
4. Add loading states and user feedback
5. Consider implementing additional OAuth providers if needed

Your Google SSO integration should now be working! Users can sign in with their Google accounts and will be automatically redirected to your organizations page.
