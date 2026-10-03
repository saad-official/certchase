import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function SignUpPage() {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Stop finding lapses after the claim</CardTitle>
        <CardDescription>
          Free for up to 10 vendors. No card needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
