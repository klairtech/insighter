import ResourceNotFound from "@/components/ResourceNotFound";

export default function NotFound() {
  return (
    <ResourceNotFound
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      backUrl="/organizations"
      backText="Go to Dashboard"
    />
  );
}
