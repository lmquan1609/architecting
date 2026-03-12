# CI/CD Architecture Diagrams

## 1. All-at-Once Deployment (Single EC2)

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CodePipeline                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Source     │       │     Build     │       │    Deploy     │
│   (GitHub)    │──────▶│  (CodeBuild)  │──────▶│ (CodeDeploy)  │
└───────────────┘       └───────────────┘       └───────────────┘
                                                         │
                                                         ▼
                                                 ┌───────────────┐
                                                 │   Single EC2  │
                                                 │   Instance    │
                                                 │               │
                                                 │  ┌─────────┐  │
                                                 │  │  App    │  │
                                                 │  │ Port    │  │
                                                 │  │ 3001    │  │
                                                 │  └─────────┘  │
                                                 └───────┬───────┘
                                                         │
                                                         ▼
                                                    ┌────────┐
                                                    │  EFS   │
                                                    │/mnt/efs│
                                                    └────────┘

Deployment: Stops app → Deploys new code → Starts app
Downtime: Yes (brief)
Rollback: Redeploy previous version
```

## 2. Rolling Deployment (Auto Scaling Group)

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CodePipeline                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Source     │       │     Build     │       │    Deploy     │
│   (GitHub)    │──────▶│  (CodeBuild)  │──────▶│ (CodeDeploy)  │
└───────────────┘       └───────────────┘       └───────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │       ALB        │
                                              │  Load Balancer   │
                                              └──────────────────┘
                                                         │
                                    ┌────────────────────┼────────────────────┐
                                    │                    │                    │
                                    ▼                    ▼                    ▼
                            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                            │   EC2 #1     │    │   EC2 #2     │    │   EC2 #3     │
                            │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │
                            │ │   App    │ │    │ │   App    │ │    │ │   App    │ │
                            │ │  v1.0    │ │    │ │  v1.0    │ │    │ │  v1.0    │ │
                            │ └──────────┘ │    │ └──────────┘ │    │ └──────────┘ │
                            └──────────────┘    └──────────────┘    └──────────────┘
                                    │                    │                    │
                                    └────────────────────┴────────────────────┘
                                                         │
                                                         ▼
                                                    ┌────────┐
                                                    │  EFS   │
                                                    │/mnt/efs│
                                                    └────────┘

Deployment Process:
Step 1: Deploy to EC2 #1 (others handle traffic)
Step 2: Deploy to EC2 #2 (others handle traffic)
Step 3: Deploy to EC2 #3 (others handle traffic)

Downtime: No
Rollback: Automatic on failure
```

## 3. Blue/Green Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CodePipeline                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Source     │       │     Build     │       │    Deploy     │
│   (GitHub)    │──────▶│  (CodeBuild)  │──────▶│ (CodeDeploy)  │
└───────────────┘       └───────────────┘       └───────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │       ALB        │
                                              │  Load Balancer   │
                                              └──────────────────┘
                                                         │
                        ┌────────────────────────────────┴────────────────────────────────┐
                        │                                                                 │
                        ▼                                                                 ▼
            ┌───────────────────────┐                                       ┌───────────────────────┐
            │   Blue Target Group   │                                       │  Green Target Group   │
            │    (Production)       │                                       │      (New)            │
            └───────────────────────┘                                       └───────────────────────┘
                        │                                                                 │
        ┌───────────────┼───────────────┐                         ┌───────────────┼───────────────┐
        ▼               ▼               ▼                         ▼               ▼               ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐             ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ EC2 #1  │     │ EC2 #2  │     │ EC2 #3  │             │ EC2 #4  │     │ EC2 #5  │     │ EC2 #6  │
  │ v1.0    │     │ v1.0    │     │ v1.0    │             │ v2.0    │     │ v2.0    │     │ v2.0    │
  └─────────┘     └─────────┘     └─────────┘             └─────────┘     └─────────┘     └─────────┘
        │               │               │                         │               │               │
        └───────────────┴───────────────┘                         └───────────────┴───────────────┘
                        │                                                         │
                        └─────────────────────────┬───────────────────────────────┘
                                                  │
                                                  ▼
                                             ┌────────┐
                                             │  EFS   │
                                             │/mnt/efs│
                                             └────────┘

Deployment Process:
1. Create Green environment (new ASG with v2.0)
2. Test Green environment
3. Switch ALB traffic: Blue → Green
4. Terminate Blue environment (optional)

Downtime: No
Rollback: Instant (switch traffic back to Blue)
```

## 4. Canary Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CodePipeline                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Source     │       │     Build     │       │    Deploy     │
│   (GitHub)    │──────▶│  (CodeBuild)  │──────▶│ (CodeDeploy)  │
└───────────────┘       └───────────────┘       └───────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │       ALB        │
                                              │  Load Balancer   │
                                              │                  │
                                              │  Traffic Split:  │
                                              │  90% → v1.0      │
                                              │  10% → v2.0      │
                                              └──────────────────┘
                                                         │
                        ┌────────────────────────────────┴────────────────────────────────┐
                        │                                                                 │
                        ▼ (90% traffic)                                    (10% traffic) ▼
            ┌───────────────────────┐                                       ┌───────────────────────┐
            │   Current Version     │                                       │    Canary Version     │
            │       (v1.0)          │                                       │       (v2.0)          │
            └───────────────────────┘                                       └───────────────────────┘
                        │                                                                 │
        ┌───────────────┼───────────────┐                                        ┌────────┴────────┐
        ▼               ▼               ▼                                        ▼                 ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐                            ┌─────────┐       ┌─────────┐
  │ EC2 #1  │     │ EC2 #2  │     │ EC2 #3  │                            │ EC2 #4  │       │ EC2 #5  │
  │ v1.0    │     │ v1.0    │     │ v1.0    │                            │ v2.0    │       │ v2.0    │
  └─────────┘     └─────────┘     └─────────┘                            └─────────┘       └─────────┘

Deployment Process:
1. Deploy v2.0 to 10% of instances
2. Monitor metrics for 5 minutes
3. If healthy: shift 100% traffic to v2.0
4. If unhealthy: rollback to v1.0

Downtime: No
Rollback: Automatic on metric failure
```

## 5. Deployment Lifecycle Hooks

```
┌─────────────────────────────────────────────────────────────────┐
│                    CodeDeploy Lifecycle                          │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  BeforeInstall   │  ← Install dependencies, mount EFS
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ ApplicationStop  │  ← Stop running application
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │   Download New   │  ← CodeDeploy downloads artifacts
    │   Application    │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  AfterInstall    │  ← npm install, set permissions
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ ApplicationStart │  ← Start application service
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ ValidateService  │  ← Health check (HTTP 200)
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │   Deployment     │
    │   Successful     │
    └──────────────────┘
```

## File Structure

```
architecting/
├── appspec.yml                 # CodeDeploy configuration
├── buildspec.yml               # CodeBuild configuration
├── test.sh                     # HTML content validation test
├── package.json                # Node.js dependencies
├── server.js                   # Application code
├── .env.example                # Environment template
│
├── public/
│   └── index.html              # Frontend
│
├── scripts/                    # Deployment hooks
│   ├── before_install.sh       # Install deps, mount EFS
│   ├── stop_application.sh     # Stop service
│   ├── after_install.sh        # npm install
│   ├── start_application.sh    # Start service
│   └── validate_service.sh     # Health check
│
└── docs/
    ├── CICD-README.md          # Overview
    ├── CICD-GUIDE.md           # Complete guide
    ├── QUICKSTART-ALLATONCE.md # Single EC2 guide
    ├── QUICKSTART-ROLLING.md   # ASG guide
    ├── QUICKSTART-BLUEGREEN.md # Blue/Green guide
    └── DEPLOYMENT-CHECKLIST.md # Pre-flight checklist
```

## Traffic Flow

### Development (All-at-Once)
```
User → EC2 Instance:3001 → EFS
```

### Production (Rolling/Blue-Green)
```
User → Route53 → ALB:80 → Target Group → EC2:3001 → EFS
                                      ├─ EC2 #1
                                      ├─ EC2 #2
                                      └─ EC2 #3
```

## Cost Comparison

```
Strategy      | Instances During Deploy | Cost Factor
─────────────────────────────────────────────────────
All-at-Once   | 1                      | 1x
Rolling       | N (same)               | 1x
Blue/Green    | 2N (double)            | 2x
Canary        | N + canary             | 1.1-1.5x
Immutable     | 2N (kept longer)       | 2-3x
```
