import * as z from "zod";

export const signUpSchema = z
    .object({
        username: z
            .string()
            .trim()
            .min(3, {message: "Username must be at least 3 characters"})
            .max(30, {message: "Username must be at most 30 characters"})
            .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores, and hyphens" }),
        email: z
            .string()
            .trim()
            .min(1, {message: "Email is required"})
            .email({message: "Please enter a valid email"}),
        password: z
            .string()
            .trim()
            .min(8, {message: "Password must be at least 8 characters long"})
            .regex(/[a-z]/, { message: "Password must include a lowercase letter" })
            .regex(/[A-Z]/, { message: "Password must include an uppercase letter" })
            .regex(/[0-9]/, { message: "Password must include a number" })
            .regex(/[^a-zA-Z0-9]/, { message: "Password must include a special character" }),
        passwordConfirmation: z
            .string()
            .trim()
            .min(1, {message: "Please confirm your password"}),
})
// predicate function 
// it shows where the message should go in the heading or the path field
.refine((data) =>  data.password === data.passwordConfirmation, {
        message: "Passwords do not match",
        path : ["passwordConfirmation"]
    })

