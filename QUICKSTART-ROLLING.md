# Quick Start: Rolling Deployment

Zero-downtime deployment to Auto Scaling Group.

## Prerequisites
- VPC with 2+ subnets
- Application Load Balancer
- Target Group
- Auto Scaling Group (2+ instances)
- EFS file system

## Step 1: Create Launch Template

```bash
# Create user data script
cat > userdata.sh <<'EOF'
#!/bin/bash
set -e

# Install dependencies
dnf update -y
dnf install -y nodejs22 git amazon-efs-utils python3 python3-pip ruby wget
pip3 install botocore

# Install CodeDeploy agent
cd /tmp
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
./install auto
systemctl start codedeploy-agent
systemctl enable codedeploy-agent

# Mount EFS
EFS_ID=$(aws ssm get-parameter --name /app/efs-id --query 'Parameter.Value' --output text --region us-east-1)
mkdir -p /mnt/efs
mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab
chown ec2-user:ec2-user /mnt/efs
chmod 755 /mnt/efs
EOF

# Encode to base64
USERDATA=$(base64 -i userdata.sh)

# Create launch template
aws ec2 create-launch-template \
  --launch-template-name image-uploader-template \
  --version-description "v1" \
  --launch-template-data "{
    \"ImageId\": \"ami-0453ec754f44f9a4a\",
    \"InstanceType\": \"t3.micro\",
    \"IamInstanceProfile\": {\"Name\": \"EC2CodeDeployRole\"},
    \"SecurityGroupIds\": [\"sg-xxxxxxxxx\"],
    \"UserData\": \"$USERDATA\",
    \"TagSpecifications\": [{
      \"ResourceType\": \"instance\",
      \"Tags\": [
        {\"Key\": \"Name\", \"Value\": \"image-uploader\"},
        {\"Key\": \"Environment\", \"Value\": \"production\"}
      ]
    }]
  }" \
  --region us-east-1
```

## Step 2: Create Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name image-uploader-asg \
  --launch-template LaunchTemplateName=image-uploader-template,Version='$Latest' \
  --min-size 2 \
  --max-size 4 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/image-uploader-tg/xxx \
  --vpc-zone-identifier "subnet-xxx,subnet-yyy" \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --tags Key=Name,Value=image-uploader,PropagateAtLaunch=true \
  --region us-east-1
```

## Step 3: Create CodeDeploy Application

```bash
# Create application
aws deploy create-application \
  --application-name image-uploader \
  --compute-platform Server \
  --region us-east-1

# Create deployment group with rolling config
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-rolling \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --auto-scaling-groups image-uploader-asg \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole \
  --region us-east-1
```

**Deployment Config Options:**
- `CodeDeployDefault.OneAtATime` - One instance at a time (slowest, safest)
- `CodeDeployDefault.HalfAtATime` - 50% of instances
- `CodeDeployDefault.AllAtOnce` - All instances (fastest, risky)

## Step 4: Create Custom Deployment Config (Optional)

```bash
# Deploy to 25% at a time
aws deploy create-deployment-config \
  --deployment-config-name Custom25Percent \
  --minimum-healthy-hosts type=FLEET_PERCENT,value=75 \
  --region us-east-1

# Use custom config
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-rolling \
  --deployment-config-name Custom25Percent \
  --auto-scaling-groups image-uploader-asg \
  --load-balancer-info targetGroupInfoList=[{name=image-uploader-tg}] \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole \
  --region us-east-1
```

## Step 5: Create CodePipeline

Update `pipeline-config.json` deployment stage:
```json
{
  "name": "Deploy",
  "actions": [
    {
      "name": "DeployAction",
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
      "inputArtifacts": [
        {
          "name": "BuildOutput"
        }
      ]
    }
  ]
}
```

Create pipeline (same as All-at-Once guide).

## Step 6: Test Rolling Deployment

```bash
# Push code
git add .
git commit -m "Test rolling deployment"
git push origin lab15-cicd

# Monitor deployment
aws deploy get-deployment \
  --deployment-id d-XXXXXXXXX \
  --region us-east-1

# Watch instances being updated
watch -n 5 'aws autoscaling describe-auto-scaling-instances \
  --query "AutoScalingInstances[?AutoScalingGroupName==\`image-uploader-asg\`].[InstanceId,LifecycleState,HealthStatus]" \
  --output table'
```

## Verify Zero Downtime

```bash
# Continuous health check during deployment
while true; do
  curl -s http://your-alb-dns/api/metadata || echo "FAILED"
  sleep 1
done
```

## Monitoring

```bash
# View deployment progress
aws deploy get-deployment \
  --deployment-id d-XXXXXXXXX \
  --query 'deploymentInfo.{Status:status,Instances:deploymentOverview}' \
  --region us-east-1

# Check instance health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/image-uploader-tg/xxx \
  --region us-east-1
```

## Rollback

```bash
# Automatic rollback on failure (configure in deployment group)
aws deploy update-deployment-group \
  --application-name image-uploader \
  --current-deployment-group-name production-rolling \
  --auto-rollback-configuration enabled=true,events=DEPLOYMENT_FAILURE,DEPLOYMENT_STOP_ON_ALARM \
  --region us-east-1

# Manual rollback
aws deploy stop-deployment \
  --deployment-id d-XXXXXXXXX \
  --auto-rollback-enabled \
  --region us-east-1
```

## Troubleshooting

**Instances not joining target group:**
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/image-uploader-tg/xxx

# Check security groups allow ALB → EC2 traffic
```

**Deployment stuck:**
```bash
# Check CodeDeploy agent on instances
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets "Key=tag:Name,Values=image-uploader" \
  --parameters 'commands=["systemctl status codedeploy-agent"]'
```

**EFS mount failures:**
```bash
# Verify EFS security group allows NFS from EC2
# Check SSM parameter exists
aws ssm get-parameter --name /app/efs-id --region us-east-1
```

## Best Practices

1. **Use health checks** - Set appropriate grace period (300s)
2. **Monitor during deployment** - Watch CloudWatch metrics
3. **Test in staging first** - Use separate ASG for staging
4. **Configure auto-rollback** - Enable on deployment failure
5. **Use custom deployment config** - Balance speed vs safety
6. **Set connection draining** - Allow in-flight requests to complete
7. **Monitor EFS performance** - Check burst credits

## Next Steps

- Add CloudWatch alarms for auto-rollback
- Configure SNS notifications
- Implement blue/green for instant rollback
- Add manual approval for production
- Setup CloudWatch dashboards
