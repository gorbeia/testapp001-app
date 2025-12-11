-- Create credits table for monthly debt calculation
CREATE TABLE credits (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id VARCHAR NOT NULL REFERENCES users(id),
    society_id VARCHAR NOT NULL REFERENCES societies(id),
    month VARCHAR NOT NULL, -- Format: "YYYY-MM" (e.g., "2024-12")
    year INTEGER NOT NULL,
    month_number INTEGER NOT NULL, -- 1-12
    consumption_amount DECIMAL(10,2) DEFAULT 0,
    reservation_amount DECIMAL(10,2) DEFAULT 0,
    kitchen_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'pending', -- "pending", "paid", "partial"
    paid_amount DECIMAL(10,2) DEFAULT 0,
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_credits_member_month ON credits(member_id, month);
CREATE INDEX idx_credits_society_month ON credits(society_id, month);
CREATE INDEX idx_credits_status ON credits(status);
CREATE UNIQUE INDEX idx_credits_member_society_month ON credits(member_id, society_id, month);
