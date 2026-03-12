# CI/CD Deployment Strategies

Complete CI/CD implementation for EFS Image Uploader using AWS CodePipeline, CodeBuild, and CodeDeploy.

## 📚 Documentation

- **[CICD-GUIDE.md](CICD-GUIDE.md)** - Complete guide with all 5 deployment strategies
- **[QUICKSTART-ALLATONCE.md](QUICKSTART-ALLATONCE.md)** - Single EC2 deployment
- **[QUICKSTART-ROLLING.md](QUICKSTART-ROLLING.md)** - Auto Scaling Group with zero downtime
- **[QUICKSTART-BLUEGREEN.md](QUICKSTART-BLUEGREEN.md)** - Instant rollback capability

## 🚀 Deployment Strategies

### 1. All-at-Once
- **Use case:** Development/staging
- **Downtime:** Yes (brief)
- **Complexity:** Low
- **Cost:** Low
- **Guide:** [QUICKSTART-ALLATONCE.md](QUICKSTART-ALLATONCE.md)

### 2. Rolling
- **Use case:** Production with ASG
- **Downtime:** No
- **Complexity:** Medium
- **Cost:** Medium
- **Guide:** [QUICKSTART-ROLLING.md](QUICKSTART-ROLLING.md)

### 3. Blue/Green
- **Use case:** Critical applications
- **Downtime:** No
- **Complexity:** High
- **Cost:** High (2x instances during deployment)
- **Guide:** [QUICKSTART-BLUEGREEN.md](QUICKSTART-BLUEGREEN.md)

### 4. Canary
- **Use case:** Risk mitigation
- **Downtime:** No
- **Complexity:** High
- **Cost:** High
- **Guide:** [CICD-GUIDE.md#4-canary-deployment](CICD-GUIDE.md#4-canary-deployment)

### 5. Immutable
- **Use case:** Maximum safety
- **Downtime:** No
- **Complexity:** High
- **Cost:** Highest
- **Guide:** [CICD-GUIDE.md#5-immutable-deployment](CICD-GUIDE.md#5-immutable-deployment)

## 📁 Required Files

All files are included in this repository:

```
.
├── appspec.yml              # CodeDeploy configuration
├── buildspec.yml            # CodeBuild configuration
├── test.sh                  # HTML content validation test
├── scripts/
│   ├── before_install.sh    # Install dependencies, mount EFS
│   ├── stop_application.sh  # Stop service
│   ├── after_install.sh     # Install npm packages
│   ├── start_application.sh # Start service
│   └── validate_service.sh  # Health check
├── server.js                # Application code
├── package.json             # Dependencies
└── public/
    └── index.html           # Frontend
```

## ⚡ Quick Start

### For Single EC2 (All-at-Once)

```bash
# 1. Install CodeDeploy agent on EC2
sudo dnf install -y ruby wget
cd /tmp
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl start codedeploy-agent

# 2. Create CodeDeploy application
aws deploy create-application \
  --application-name image-uploader \
  --compute-platform Server

# 3. Create deployment group
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --ec2-tag-filters Key=Name,Value=image-uploader,Type=KEY_AND_VALUE \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole

# 4. Create CodePipeline (see QUICKSTART-ALLATONCE.md)
```

### For Auto Scaling Group (Rolling)

```bash
# 1. Create ASG with CodeDeploy agent in user data
# 2. Create deployment group with ASG
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-rolling \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --auto-scaling-groups image-uploader-asg \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole

# 3. Create CodePipeline (see QUICKSTART-ROLLING.md)
```

## 🔧 Configuration

### Environment Variables

Store in SSM Parameter Store or EC2 user data:

```bash
# EFS ID
aws ssm put-parameter \
  --name /app/efs-id \
  --value "fs-xxxxxxxxx" \
  --type String

# Application port
aws ssm put-parameter \
  --name /app/port \
  --value "3001" \
  --type String
```

### IAM Roles Required

1. **EC2 Instance Role** - S3, EFS, SSM access
2. **CodeDeploy Service Role** - EC2, ASG, ELB access
3. **CodeBuild Service Role** - Logs, S3 access
4. **CodePipeline Service Role** - CodeBuild, CodeDeploy, S3 access

See [CICD-GUIDE.md](CICD-GUIDE.md) for complete IAM policies.

## 📊 Comparison Matrix

| Strategy | Downtime | Rollback | Cost | Complexity | Best For |
|----------|----------|----------|------|------------|----------|
| All-at-Once | Yes | Slow | Low | Low | Dev/Test |
| Rolling | No | Medium | Medium | Medium | Production |
| Blue/Green | No | Instant | High | High | Critical Apps |
| Canary | No | Fast | High | High | Risk Mitigation |
| Immutable | No | Instant | Highest | High | Maximum Safety |

## 🔍 Monitoring

```bash
# Pipeline status
aws codepipeline get-pipeline-state --name image-uploader-pipeline

# Deployment status
aws deploy get-deployment --deployment-id d-XXXXXXXXX

# Application logs
sudo journalctl -u demo-app -f

# CodeDeploy agent logs
sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
```

## 🐛 Troubleshooting

### CodeDeploy Agent Not Running
```bash
sudo systemctl restart codedeploy-agent
sudo systemctl status codedeploy-agent
```

### Deployment Failed
```bash
# Check deployment logs
aws deploy get-deployment --deployment-id d-XXXXXXXXX

# Check instance logs
sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
```

### Application Not Starting
```bash
# Check service status
sudo systemctl status demo-app

# View application logs
sudo journalctl -u demo-app -n 100

# Check EFS mount
df -h | grep efs
```

## 📖 Additional Resources

- [AWS CodeDeploy Documentation](https://docs.aws.amazon.com/codedeploy/)
- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
- [AppSpec File Reference](https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file.html)

## 🎯 Next Steps

1. Choose deployment strategy based on requirements
2. Follow the appropriate quick start guide
3. Test in development environment first
4. Add CloudWatch alarms for monitoring
5. Configure SNS notifications
6. Implement auto-rollback policies
7. Setup staging pipeline for testing

## 📝 Notes

- All scripts are executable and ready to use
- EFS ID can be stored in SSM Parameter Store or environment variables
- Health checks validate application before marking deployment successful
- Automatic rollback on validation failure
- Support for both single EC2 and Auto Scaling Group deployments
