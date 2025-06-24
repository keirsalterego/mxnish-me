---
title: "Unlocking the Power of Zero-Sized Types in Rust: A Guide to State Machines"
tags: ["Rust", "Zero-Sized Types"]

---

# Unlocking the Power of Zero-Sized Types in Rust: A Guide to State Machines

For many Rustaceans, zero-side type is an underappreciated notion. We'll see its lustre.

## A type of struct with no fields

### The contemporary type system in Rust

Many of the positive aspects of older languages have been incorporated into Rust, a contemporary language. For instance, the idea of Rust's Traits is similar to that of Java/Typescript's Interfaces and Haskell's Type Classes. Additionally, several functional programming languages serve as inspiration for special types like Option and Result. Rust's type system offers an exceptional development experience because of those embraced notions.

### Zero-sized type

Today I'd want to discuss one of the most underappreciated type patterns: zero-sized type (abbreviated as ZST). We can make a declaration like this.

```rust
struct ZeroSizedType;
```

ZST has no fields, therefore there is no need to allocate memory space for this type - hence the term 'zero-sized'! The question is, what is the purpose of a struct type if it is not created with fields? Let us find out.

## Application of zero-sized type - a state machine

A state machine is the most straightforward illustration of how zero-sized type is used. But what is a "state machine"? Therefore, if we go online and browse Wikipedia, we'll see

> _" A finite-state machine (FSM) or finite-state automaton (FSA, plural: automata), finite automaton, or simply a **state machine**, is a mathematical model of computation. It is an abstract machine that can be in exactly one of a finite number of states at any given time. The FSM can change from one state to another in response to some inputs; the change from one state to another is called a transition."_

Although they appear to be somewhat scholarly, state machines are readily seen in everyday life. As seen in the sample image below, we have a straightforward procedure for a **Job Application Tracking System.** It's a state machine since it has state transitions between **Draft, Submitted, Under Review**, **Interview Scheduled, Offer Extended, Rejected, Hired.**

We may generate a variety of situations (or routes) by linking transitions.

1. **Start at [Draft]**: The application is being prepared.
2. **Transition to [Submitted]**: The applicant submits the application.
3. **Transition to [Under Review]**: The employer begins reviewing the application.
4. **From [Under Review]**:  
   * If shortlisted, move to **[Interview Scheduled]**.  
   * If not shortlisted, move to **[Rejected]**.
5. **From [Interview Scheduled]**:  
   * If the interview goes well, move to **[Offer Extended]**.  
   * If the interview doesn't go well, move to **[Rejected]**.
6. **From [Offer Extended]**:  
   * If the offer is accepted, move to **[Hired]**.  
   * If the offer is declined, move to **[Rejected]**.

What a drastic change in circumstances! There are many combinations that we can achieve. Name one!

## The Code, Explained Simply

Let's dissect the code piece by piece. Don't worry if you don't know Rust yet—I'll explain it like I'm chatting with a friend who's curious but new to this.

1. **Setting the Stage with use Statements**

```rust
use std::fmt;
use std::io;
```

These lines are like importing tools from a toolbox. Rust has a big library of helpful stuff, and we're grabbing two parts:

* std::fmt: Helps us control how things look when printed (like formatting text).
* std::io: Lets us read what you type into the terminal and print messages back.

2. **Defining the Hiring Stages with enum**  
```rust
enum HiringStage {  
    Draft,  
    Submitted,  
    UnderReview,  
    InterviewScheduled,  
    OfferExtended,  
    Hired,  
    Rejected,  
}  
```

Here, we're creating a list of possible stages a candidate can be in—it's called an enum (short for "enumeration"). Think of it as a multiple-choice list where only one option can be true at a time. The stages are:  
* Draft: The application isn't submitted yet.  
* Submitted: They've sent it in.  
* UnderReview: You're looking it over.  
* InterviewScheduled: They've got an interview booked.  
* OfferExtended: You've made them an offer.  
* Hired: They're in!  
* Rejected: Sorry, not this time.

Also made the program how to display these stages nicely:

```rust
impl fmt::Display for HiringStage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}
```

This says, "When we print a HiringStage, just show its name (like Draft or Hired)." It's a bit technical, but it makes our output readable.

3. **Creating the Candidate Blueprint**  
```rust
struct Candidate {  
    name: String,  
    stage: HiringStage,  
}  
```

A struct is like a template for a candidate. Each candidate has:  
* A name (like "Manish" or "Yuvraj" or "Arindam" or "Amlan"), stored as text (String).  
* A stage, which tracks where they are in the hiring process (using our `HiringStage` enum).

4. **Giving the Candidate Actions**  
Next, we define what a Candidate can do with a bunch of functions inside an impl block (short for "implementation"). These are like instructions for moving through the hiring process.  
```rust
fn new(name: &str) -> Self {  
    Self {  
        name: name.to_string(),  
        stage: HiringStage::Draft,  
    }  
}  
```

This creates a new candidate. You give it a name (e.g., "Alice"), and it starts them at the Draft stage. The &str means the name comes in as a slice of text, and to_string() turns it into a proper String we can store.  

* **Step 1:** `submit_application`

```rust
fn submit_application(&mut self) {
    self.stage = HiringStage::Submitted;
    println!("{} has submitted the application.", self.name);
}
```

This moves the candidate to Submitted and prints a message. The &mut self means the function can change the candidate's details (like updating their stage).

* **Step 2:** `review_application`

```rust
fn review_application(&mut self) {
    self.stage = HiringStage::UnderReview;
    println!("{}'s application is under review.", self.name);
    println!("Was the candidate shortlisted? (yes/no): ");
    let mut input = String::new();
    io::stdin().read_line(&mut input).expect("Failed to read input");
    let input = input.trim().to_lowercase();
    if input == "yes" {
        self.schedule_interview();
    } else {
        self.reject();
    }
}
```

Here's where it gets interactive! The candidate moves to `UnderReview`, and the program asks you, "Was the candidate shortlisted?" You type "yes" or "no":

* "Yes" → Schedules an interview.
* "No" → Rejects them.

We use `io::stdin().read_line()` to grab what you type, clean it up with `trim()` and `to_lowercase()`, and decide what to do next.

* **Step 3:** `schedule_interview`  
```rust
fn schedule_interview(&mut self) {  
    self.stage = HiringStage::InterviewScheduled;  
    println!("{} has been scheduled for an interview.", self.name);  
}  
```

Moves them to InterviewScheduled and tells you about it.

* **Step 4:** `make_offer`  
```rust
fn make_offer(&mut self) {  
    self.stage = HiringStage::OfferExtended;  
    println!("An offer has been extended to {}.", self.name);  
    println!("Did the candidate accept the offer? (yes/no): ");  
    let mut input = String::new();  
    io::stdin().read_line(&mut input).expect("Failed to read input");  
    let input = input.trim().to_lowercase();  
    if input == "yes" {  
        self.hire();  
    } else {  
        self.reject();  
    }  
}  
```

Another decision point! The candidate gets an offer, and you say "yes" or "no" to whether they accept:  
* "Yes" → They're hired.  
* "No" → They're rejected.

* **Final Steps:** `hire` and `reject`

```rust
fn hire(&mut self) {
    self.stage = HiringStage::Hired;
    println!("{} has been hired!", self.name);
}

fn reject(&mut self) {
    self.stage = HiringStage::Rejected;
    println!("{} has been rejected.", self.name);
}
```

These wrap things up—either the candidate joins the team or gets a polite "no thanks."

* **Running the Show:** `main`  
```rust
fn main() {  
    println!("Enter candidate's name: ");  
    let mut name = String::new();  
    io::stdin().read_line(&mut name).expect("Failed to read input");  
    let name = name.trim();  
    let mut candidate = Candidate::new(name);  
    candidate.submit_application();  
    candidate.review_application();  
    candidate.make_offer();  
}  
```

This is where the program starts. It:  
* Asks for a name and reads what you type.  
* Creates a Candidate with that name.  
* Runs them through the process: submit → review → offer.

The `mut` keyword means we can change the candidate as we go.

## How It Looks When You Run It

Let's say you run this in a terminal. Here's an example:

```
┌─[keir@parrot]─[~/rustycargo/zst-blog]
└──╼ $cargo run
   Compiling zst-blog v0.1.0 (/home/keir/rustycargo/zst-blog)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.12s
     Running `target/debug/zst-blog`
Enter candidate's name: 
manish
manish has submitted the application.
manish's application is under review.
Was the candidate shortlisted? (yes/no): 
yes
manish has been scheduled for an interview.
An offer has been extended to manish.
Did the candidate accept the offer? (yes/no): 
yes
manish has been hired!
```

Or if things don't go well:

```
┌─[✗]─[keir@parrot]─[~/rustycargo/zst-blog]
└──╼ $cargo run
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.03s
     Running `target/debug/zst-blog`
Enter candidate's name: 
manish
manish has submitted the application.
manish's application is under review.
Was the candidate shortlisted? (yes/no): 
n
manish has been rejected.
```

## Why This Is Cool

This program is a tiny taste of what Rust can do. It's:

* **Safe**: Rust makes sure we don't mess up memory (a common bug in other languages).
* **Interactive**: It talks to you and listens to your answers.
* **Structured**: The enum and struct keep everything organized.

You could expand it — add more stages, store multiple candidates, or save data to a file. It's a foundation for something bigger!

## Final Thoughts

I hope this made sense! We took a Rust program and turned it into a story about hiring candidates. You've seen how Rust handles data (with struct and enum), takes input, and makes decisions. If you're curious, try running it yourself—grab Rust from rust-lang.org, paste this code into a file (like main.rs), and type cargo run in your terminal.

What do you think? Want to tweak it or have questions? Let me know—I'm happy to chat more about Rust or coding in general!

```
  .-""""""""-.
 .'   >>>>    '.
: ,  *HAPPY* : ' 
 `._  CODING _.' 
    `"'"""""'"` 
   /|   ^^   |\
  / |  >>>> |  \
 /  |________|  \
 |  .--------.  | 
 |  :   *    :  | 
 |  :   *    :  | 
 |  '--------'  | 
 |___[CODE ON]__|
``` 