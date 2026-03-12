# CI/CD Deployment Guide

Complete guide for deploying the EFS Image Uploader application using AWS CodePipeline, CodeBuild, and CodeDeploy.

## Table of Contents
1. [All-at-Once Deployment](#1-all-at-once-deployment) - Single EC2 instance
2. [Rolling Deployment](#2-rolling-deployment) - Auto Scaling Group
3. [Blue/Green Deployment](#3-bluegreen-deployment) - Zero downtime
4. [Canary Deployment](#4-canary-deployment) - Gradual traffic shift
5. [Immutable Deployment](#5-immutable-deployment) - New instances

---

## Prerequisites

### Common Requirements
- GitHub repository with your code
- AWS Account with appropriate permissions
- EFS file system created
- VPC with subnets

### IAM Roles Needed
```bash
# CodePipeline Service Role
# CodeBuild Service Role  
# CodeDeploy Service Role
# EC2 Instance Role
```

---

## 1. All-at-Once Deployment

**Best for:** Development/staging environments, single EC2 instance
**Downtime:** Yes (brief)
**Rollback:** Manual redeployment
**Complexity:** Low

### Architecture
```
GitHub → CodePipeline → CodeBuild → CodeDeploy → Single EC2
```

### Step 1: Create CodeDeploy Application Files

Create `appspec.yml` in repository root:

```yaml
version: 0.0
os: linux
files:
  - source: /
    destination: /home/ec2-user/app
hooks:
  BeforeInstall:
    - location: scripts/before_install.sh
      timeout: 300
      runas: root
  AfterInstall:
    - location: scripts/after_install.sh
      timeout: 300
      runas: root
  ApplicationStart:
    - location: scripts/start_application.sh
      timeout: 300
      runas: root
  ApplicationStop:
    - location: scripts/stop_application.sh
      timeout: 300
      runas: root
```

### Step 2: Create Deployment Scripts

Create `scripts/before_install.sh`:
```bash
#!/bin/bash
# Install dependencies if not present
if ! command -v node &> /dev/null; then
  dnf install -y nodejs22 amazon-efs-utils
fi

# Mount EFS if not mounted
if ! mountpoint -q /mnt/efs; then
  mkdir -p /mnt/efs
  mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
  chown ec2-user:ec2-user /mnt/efs
fi
```

Create `scripts/stop_application.sh`:
```bash
#!/bin/bash
systemctl stop demo-app || true
```

Create `scripts/after_install.sh`:
```bash
#!/bin/bash
cd /home/ec2-user/app
npm install --production
chown -R ec2-user:ec2-user /home/ec2-user/app
```

Create `scripts/start_application.sh`:
```bash
#!/bin/bash
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
```

### Step 3: Create buildspec.yml

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 22
  pre_build:
    commands:
      - echo "Installing dependencies..."
      - npm install
  build:
    commands:
      - echo "Running tests..."
      - chmod +x test.sh
      - ./test.sh
      - echo "Build completed on $(date)"
artifacts:
  files:
    - '**/*'
```

**Test Script (test.sh):**
```bash
#!/bin/bash
set -e

echo "Running HTML content tests..."

# Test: Check if h1 tag contains "AWS Storage"
if grep -q '<h1>.*AWS Storage.*</h1>' public/index.html; then
  echo "✓ Test passed: h1 tag contains 'AWS Storage'"
else
  echo "✗ Test failed: h1 tag does not contain 'AWS Storage'"
  exit 1
fi

echo "All tests passed!"
```

The build will fail if the test doesn't pass, preventing broken code from being deployed.

### Step 4: Create IAM Roles

**CodePipeline Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "codebuild:StartBuild",
        "codebuild:BatchGetBuilds",
        "codedeploy:CreateDeployment",
        "codedeploy:GetDeployment",
        "codedeploy:GetApplication",
        "codedeploy:GetDeploymentConfig",
        "codedeploy:RegisterApplicationRevision"
      ],
      "Resource": "*"
    }
  ]
}
```

**CodeBuild Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "*"
    }
  ]
}
```

**CodeDeploy Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "autoscaling:*",
        "elasticloadbalancing:*",
        "s3:GetObject"
      ],
      "Resource": "*"
    }
  ]
}
```

**EC2 Instance Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "elasticfilesystem:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Step 5: Setup EC2 Instance

```bash
# Install CodeDeploy agent
sudo dnf install -y ruby wget
cd /tmp
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl start codedeploy-agent
sudo systemctl enable codedeploy-agent

# Create systemd service file
sudo tee /etc/systemd/system/demo-app.service > /dev/null <<'EOF'
[Unit]
Description=Image Upload Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/app
EnvironmentFile=/home/ec2-user/app/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create .env file
sudo tee /home/ec2-user/app/.env > /dev/null <<EOF
PORT=3001
UPLOAD_DIR=/mnt/efs
EFS_ID=fs-xxxxxxxxx
EOF
```

### Step 6: Create CodeDeploy Application

```bash
# Create application
aws deploy create-application \
  --application-name image-uploader \
  --compute-platform Server

# Create deployment group
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --ec2-tag-filters Key=Name,Value=image-uploader,Type=KEY_AND_VALUE \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployRole
```

### Step 7: Create CodeBuild Project

```bash
aws codebuild create-project \
  --name image-uploader-build \
  --source type=CODEPIPELINE \
  --artifacts type=CODEPIPELINE \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL \
  --service-role arn:aws:iam::ACCOUNT_ID:role/CodeBuildRole
```

### Step 8: Create CodePipeline

```bash
aws codepipeline create-pipeline --cli-input-json file://pipeline.json
```

`pipeline.json`:
```json
{
  "pipeline": {
    "name": "image-uploader-pipeline",
    "roleArn": "arn:aws:iam::ACCOUNT_ID:role/CodePipelineRole",
    "artifactStore": {
      "type": "S3",
      "location": "codepipeline-artifacts-bucket"
    },
    "stages": [
      {
        "name": "Source",
        "actions": [
          {
            "name": "Source",
            "actionTypeId": {
              "category": "Source",
              "owner": "ThirdParty",
              "provider": "GitHub",
              "version": "1"
            },
            "configuration": {
              "Owner": "your-github-username",
              "Repo": "architecting",
              "Branch": "lab15-cicd",
              "OAuthToken": "{{resolve:secretsmanager:github-token}}"
            },
            "outputArtifacts": [{"name": "SourceOutput"}]
          }
        ]
      },
      {
        "name": "Build",
        "actions": [
          {
            "name": "Build",
            "actionTypeId": {
              "category": "Build",
              "owner": "AWS",
              "provider": "CodeBuild",
              "version": "1"
            },
            "configuration": {
              "ProjectName": "image-uploader-build"
            },
            "inputArtifacts": [{"name": "SourceOutput"}],
            "outputArtifacts": [{"name": "BuildOutput"}]
          }
        ]
      },
      {
        "name": "Deploy",
        "actions": [
          {
            "name": "Deploy",
            "actionTypeId": {
              "category": "Deploy",
              "owner": "AWS",
              "provider": "CodeDeploy",
              "version": "1"
            },
            "configuration": {
              "ApplicationName": "image-uploader",
              "DeploymentGroupName": "production"
            },
            "inputArtifacts": [{"name": "BuildOutput"}]
          }
        ]
      }
    ]
  }
}
```

### Step 9: Test Deployment

```bash
# Push code to GitHub
git add .
git commit -m "Add CI/CD configuration"
git push origin lab15-cicd

# Monitor pipeline
aws codepipeline get-pipeline-state --name image-uploader-pipeline

# Check deployment
aws deploy get-deployment --deployment-id d-XXXXXXXXX
```

---

## 2. Rolling Deployment

**Best for:** Production with Auto Scaling Group
**Downtime:** No
**Rollback:** Automatic on failure
**Complexity:** Medium

### Architecture
```
GitHub → CodePipeline → CodeBuild → CodeDeploy → ALB → ASG (multiple EC2)
```

### Step 1: Update appspec.yml

Same as All-at-Once (no changes needed)

### Step 2: Create Auto Scaling Group

```bash
# Create Launch Template
aws ec2 create-launch-template \
  --launch-template-name image-uploader-template \
  --version-description "v1" \
  --launch-template-data '{
    "ImageId": "ami-xxxxxxxxx",
    "InstanceType": "t3.micro",
    "IamInstanceProfile": {"Name": "EC2CodeDeployRole"},
    "SecurityGroupIds": ["sg-xxxxxxxxx"],
    "UserData": "BASE64_ENCODED_USERDATA",
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{"Key": "Name", "Value": "image-uploader"}]
    }]
  }'

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name image-uploader-asg \
  --launch-template LaunchTemplateName=image-uploader-template,Version='$Latest' \
  --min-size 2 \
  --max-size 4 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/image-uploader-tg/xxx \
  --vpc-zone-identifier "subnet-xxx,subnet-yyy"
```

### Step 3: Create Deployment Group with Rolling Config

```bash
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-rolling \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --auto-scaling-groups image-uploader-asg \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployRole
```

**Deployment Configurations:**
- `CodeDeployDefault.OneAtATime` - Deploy to one instance at a time
- `CodeDeployDefault.HalfAtATime` - Deploy to 50% of instances
- `CodeDeployDefault.AllAtOnce` - Deploy to all instances simultaneously

### Step 4: Custom Deployment Config (Optional)

```bash
# Deploy to 25% at a time
aws deploy create-deployment-config \
  --deployment-config-name Custom25Percent \
  --minimum-healthy-hosts type=FLEET_PERCENT,value=75
```

### Step 5: Update Pipeline

Update `pipeline.json` deployment stage:
```json
{
  "name": "Deploy",
  "actions": [{
    "name": "Deploy",
    "actionTypeId": {
      "category": "Deploy",
      "owner": "AWS",
      "provider": "CodeDeploy",
      "version": "1"
    },
    "configuration": {
      "ApplicationName": "image-uploader",
      "DeploymentGroupName": "production-rolling"
    },
    "inputArtifacts": [{"name": "BuildOutput"}]
  }]
}
```

---

## 3. Blue/Green Deployment

**Best for:** Production requiring instant rollback
**Downtime:** No
**Rollback:** Instant (traffic reroute)
**Complexity:** High

### Architecture
```
GitHub → CodePipeline → CodeBuild → CodeDeploy → ALB
                                                    ├─ Blue Target Group (current)
                                                    └─ Green Target Group (new)
```

### Step 1: Create Blue/Green Deployment Group

```bash
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-bluegreen \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --auto-scaling-groups image-uploader-asg \
  --blue-green-deployment-configuration '{
    "terminateBlueInstancesOnDeploymentSuccess": {
      "action": "TERMINATE",
      "terminationWaitTimeInMinutes": 5
    },
    "deploymentReadyOption": {
      "actionOnTimeout": "CONTINUE_DEPLOYMENT"
    },
    "greenFleetProvisioningOption": {
      "action": "COPY_AUTO_SCALING_GROUP"
    }
  }' \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployRole
```

### Step 2: Update appspec.yml for Blue/Green

```yaml
version: 0.0
os: linux
files:
  - source: /
    destination: /home/ec2-user/app
hooks:
  BeforeInstall:
    - location: scripts/before_install.sh
      timeout: 300
      runas: root
  AfterInstall:
    - location: scripts/after_install.sh
      timeout: 300
      runas: root
  ApplicationStart:
    - location: scripts/start_application.sh
      timeout: 300
      runas: root
  ValidateService:
    - location: scripts/validate_service.sh
      timeout: 300
      runas: root
```

Create `scripts/validate_service.sh`:
```bash
#!/bin/bash
# Wait for application to start
sleep 10

# Health check
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/metadata)
if [ $response -eq 200 ]; then
  echo "Application is healthy"
  exit 0
else
  echo "Application health check failed"
  exit 1
fi
```

### Step 3: Configure Manual Approval (Optional)

Update pipeline to add approval before traffic shift:

```json
{
  "name": "Approval",
  "actions": [{
    "name": "ManualApproval",
    "actionTypeId": {
      "category": "Approval",
      "owner": "AWS",
      "provider": "Manual",
      "version": "1"
    },
    "configuration": {
      "CustomData": "Review green environment before traffic shift"
    }
  }]
}
```

---

## 4. Canary Deployment

**Best for:** Production with gradual rollout
**Downtime:** No
**Rollback:** Automatic if metrics fail
**Complexity:** High

### Step 1: Create Canary Deployment Config

```bash
aws deploy create-deployment-config \
  --deployment-config-name Canary10Percent5Minutes \
  --traffic-routing-config '{
    "type": "TimeBasedCanary",
    "timeBasedCanary": {
      "canaryPercentage": 10,
      "canaryInterval": 5
    }
  }' \
  --compute-platform Server
```

**Canary Options:**
- `Canary10Percent5Minutes` - 10% traffic for 5 min, then 100%
- `Canary10Percent15Minutes` - 10% traffic for 15 min, then 100%
- Custom percentages and intervals

### Step 2: Create Deployment Group with Canary

```bash
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-canary \
  --deployment-config-name Canary10Percent5Minutes \
  --auto-scaling-groups image-uploader-asg \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployRole
```

### Step 3: Add CloudWatch Alarms (Optional)

```bash
# Create alarm for error rate
aws cloudwatch put-metric-alarm \
  --alarm-name image-uploader-errors \
  --alarm-description "High error rate" \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Link alarm to deployment
aws deploy put-lifecycle-event-hook-execution-status \
  --deployment-id d-XXXXXXXXX \
  --lifecycle-event-hook-execution-id xxx \
  --status Succeeded
```

---

## 5. Immutable Deployment

**Best for:** Maximum safety, critical production
**Downtime:** No
**Rollback:** Keep old ASG, instant switch
**Complexity:** High

### Architecture
```
GitHub → CodePipeline → CodeBuild → CodeDeploy → Create New ASG → Test → Swap → Terminate Old ASG
```

### Step 1: Create Immutable Deployment Group

```bash
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-immutable \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --blue-green-deployment-configuration '{
    "terminateBlueInstancesOnDeploymentSuccess": {
      "action": "KEEP_ALIVE"
    },
    "deploymentReadyOption": {
      "actionOnTimeout": "STOP_DEPLOYMENT",
      "waitTimeInMinutes": 15
    },
    "greenFleetProvisioningOption": {
      "action": "COPY_AUTO_SCALING_GROUP"
    }
  }' \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployRole
```

### Step 2: Manual Cleanup Script

Create `cleanup-old-asg.sh`:
```bash
#!/bin/bash
# List old ASGs
aws autoscaling describe-auto-scaling-groups \
  --query 'AutoScalingGroups[?contains(AutoScalingGroupName, `CodeDeploy`)].AutoScalingGroupName' \
  --output text

# Delete old ASG after verification
read -p "Enter ASG name to delete: " ASG_NAME
aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name $ASG_NAME \
  --force-delete
```

---

## Comparison Matrix

| Strategy | Downtime | Rollback Speed | Cost | Complexity | Best For |
|----------|----------|----------------|------|------------|----------|
| All-at-Once | Yes | Slow | Low | Low | Dev/Test |
| Rolling | No | Medium | Medium | Medium | Production |
| Blue/Green | No | Instant | High | High | Critical Apps |
| Canary | No | Fast | High | High | Risk Mitigation |
| Immutable | No | Instant | Highest | High | Maximum Safety |

---

## Monitoring & Troubleshooting

### View Pipeline Status
```bash
aws codepipeline get-pipeline-state --name image-uploader-pipeline
```

### View Deployment Status
```bash
aws deploy get-deployment --deployment-id d-XXXXXXXXX
```

### View CodeBuild Logs
```bash
aws logs tail /aws/codebuild/image-uploader-build --follow
```

### View Application Logs
```bash
# On EC2 instance
sudo journalctl -u demo-app -f
```

### Rollback Deployment
```bash
# Stop current deployment
aws deploy stop-deployment --deployment-id d-XXXXXXXXX --auto-rollback-enabled

# Manual rollback to previous revision
aws deploy create-deployment \
  --application-name image-uploader \
  --deployment-group-name production \
  --revision revisionType=S3,s3Location={bucket=artifacts,key=previous.zip,bundleType=zip}
```

---

## Best Practices

1. **Use GitHub Secrets for sensitive data**
2. **Enable CloudWatch Logs for all services**
3. **Tag all resources for cost tracking**
4. **Use Parameter Store for configuration**
5. **Implement health checks in ValidateService hook**
6. **Test deployments in staging first**
7. **Keep old ASG for 24h before deletion (Immutable)**
8. **Monitor error rates during Canary deployments**
9. **Use manual approval for production Blue/Green**
10. **Backup EFS before major deployments**

---

## Next Steps

1. Choose deployment strategy based on your requirements
2. Create required IAM roles
3. Add CodeDeploy configuration files to repository
4. Setup infrastructure (EC2/ASG/ALB)
5. Create CodePipeline
6. Test with a small change
7. Monitor and iterate
