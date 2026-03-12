# CI/CD Deployment Checklist

Use this checklist to ensure all prerequisites are met before deploying.

## ✅ Pre-Deployment Checklist

### AWS Infrastructure
- [ ] VPC created with at least 2 subnets
- [ ] EFS file system created
- [ ] EFS security group allows NFS (port 2049) from EC2
- [ ] EFS mount targets created in all subnets
- [ ] EC2 security group allows HTTP (port 3001)
- [ ] (For ASG) Application Load Balancer created
- [ ] (For ASG) Target Group created with health checks
- [ ] (For ASG) ALB security group allows HTTP/HTTPS

### IAM Roles
- [ ] EC2 Instance Role created with policies:
  - S3 GetObject access
  - EFS full access
  - SSM GetParameter access
- [ ] CodeDeploy Service Role created with trust policy
- [ ] CodeBuild Service Role created
- [ ] CodePipeline Service Role created

### EC2 Instance (All-at-Once)
- [ ] EC2 instance launched with Instance Role attached
- [ ] Instance tagged with `Name=image-uploader`
- [ ] CodeDeploy agent installed and running
- [ ] EFS mounted to `/mnt/efs`
- [ ] Node.js 22 installed

### Auto Scaling Group (Rolling/Blue-Green)
- [ ] Launch Template created with:
  - Correct AMI (Amazon Linux 2023)
  - Instance Role attached
  - User data includes CodeDeploy agent installation
  - User data includes EFS mount commands
- [ ] Auto Scaling Group created
- [ ] ASG attached to Target Group
- [ ] Health check grace period set (300s recommended)

### GitHub Repository
- [ ] Repository contains all application files
- [ ] `appspec.yml` in repository root
- [ ] `buildspec.yml` in repository root
- [ ] `scripts/` directory with all hook scripts
- [ ] Scripts are executable (`chmod +x scripts/*.sh`)
- [ ] GitHub Personal Access Token created
- [ ] Token stored in AWS Secrets Manager

### AWS CodeDeploy
- [ ] CodeDeploy application created
- [ ] Deployment group created with correct configuration
- [ ] Deployment group linked to EC2 tags or ASG
- [ ] (For ASG) Load balancer info configured
- [ ] Service role attached

### AWS CodeBuild
- [ ] CodeBuild project created
- [ ] Build environment: Amazon Linux, Node.js 22
- [ ] Service role attached
- [ ] Artifacts configured for CodePipeline

### AWS CodePipeline
- [ ] S3 bucket created for artifacts
- [ ] Pipeline created with 3 stages:
  - Source (GitHub)
  - Build (CodeBuild)
  - Deploy (CodeDeploy)
- [ ] Service role attached
- [ ] GitHub connection configured

### Configuration
- [ ] EFS ID stored in SSM Parameter Store (`/app/efs-id`)
- [ ] Application port configured (default: 3001)
- [ ] Environment variables set in `.env` or user data

## 🧪 Testing Checklist

### Before First Deployment
- [ ] CodeDeploy agent status verified on all instances
- [ ] EFS mount verified on all instances
- [ ] Security groups allow required traffic
- [ ] IAM roles have correct permissions
- [ ] GitHub webhook configured (if using)

### After Deployment
- [ ] Pipeline executed successfully
- [ ] All stages completed (Source → Build → Deploy)
- [ ] CodeDeploy deployment status: Succeeded
- [ ] Application service running (`systemctl status demo-app`)
- [ ] Health check endpoint responding (`/api/metadata`)
- [ ] Images can be uploaded to EFS
- [ ] Images can be viewed and deleted
- [ ] (For ASG) All instances healthy in target group
- [ ] (For ASG) ALB routing traffic correctly

### Rollback Testing
- [ ] Rollback procedure documented
- [ ] Auto-rollback configured (optional)
- [ ] Manual rollback tested in staging
- [ ] Previous deployment artifacts retained

## 🔍 Verification Commands

### Check CodeDeploy Agent
```bash
sudo systemctl status codedeploy-agent
```

### Check EFS Mount
```bash
df -h | grep efs
mountpoint /mnt/efs
ls -la /mnt/efs
```

### Check Application Service
```bash
sudo systemctl status demo-app
sudo journalctl -u demo-app -n 50
```

### Test Application
```bash
curl http://localhost:3001/api/metadata
```

### Check Pipeline Status
```bash
aws codepipeline get-pipeline-state --name image-uploader-pipeline
```

### Check Deployment Status
```bash
aws deploy list-deployments \
  --application-name image-uploader \
  --deployment-group-name production \
  --include-only-statuses Succeeded Failed InProgress
```

### Check Target Health (ASG)
```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/image-uploader-tg/xxx
```

## 📋 Deployment Strategy Selection

Choose based on your requirements:

### All-at-Once
- [ ] Single EC2 instance
- [ ] Development/staging environment
- [ ] Downtime acceptable
- [ ] Simple setup required

### Rolling
- [ ] Auto Scaling Group with 2+ instances
- [ ] Production environment
- [ ] Zero downtime required
- [ ] Gradual rollout acceptable

### Blue/Green
- [ ] Auto Scaling Group
- [ ] Production environment
- [ ] Instant rollback required
- [ ] Can afford 2x instances during deployment

### Canary
- [ ] Auto Scaling Group
- [ ] Production environment
- [ ] Risk mitigation required
- [ ] Gradual traffic shift needed

### Immutable
- [ ] Auto Scaling Group
- [ ] Critical production environment
- [ ] Maximum safety required
- [ ] Can afford highest cost

## 🚨 Common Issues

### Issue: CodeDeploy agent not running
**Solution:**
```bash
sudo systemctl restart codedeploy-agent
sudo systemctl enable codedeploy-agent
```

### Issue: EFS mount failed
**Solution:**
- Check EFS security group allows NFS from EC2
- Verify EFS ID is correct
- Check EFS mount targets exist in instance subnet

### Issue: Deployment failed at BeforeInstall
**Solution:**
- Check script permissions (`chmod +x scripts/*.sh`)
- Review `/var/log/aws/codedeploy-agent/codedeploy-agent.log`
- Verify IAM role has required permissions

### Issue: Application not starting
**Solution:**
- Check application logs: `sudo journalctl -u demo-app -n 100`
- Verify `.env` file exists with correct values
- Check Node.js is installed: `node --version`
- Verify EFS is mounted: `df -h | grep efs`

### Issue: Health check failing
**Solution:**
- Test locally: `curl http://localhost:3001/api/metadata`
- Check security group allows port 3001
- Verify application is listening on correct port
- Check application logs for errors

## 📝 Post-Deployment Tasks

- [ ] Monitor CloudWatch metrics
- [ ] Setup CloudWatch alarms
- [ ] Configure SNS notifications
- [ ] Document rollback procedure
- [ ] Schedule regular backups
- [ ] Review and optimize costs
- [ ] Update documentation
- [ ] Train team on deployment process

## 🎯 Production Readiness

Before going to production:

- [ ] Tested in staging environment
- [ ] Rollback procedure verified
- [ ] Monitoring and alerting configured
- [ ] Auto-rollback policies set
- [ ] Manual approval gates added (if required)
- [ ] Disaster recovery plan documented
- [ ] Team trained on troubleshooting
- [ ] Runbook created for common issues
- [ ] On-call rotation established
- [ ] Incident response plan ready

---

**Note:** This checklist should be customized based on your specific requirements and environment.
